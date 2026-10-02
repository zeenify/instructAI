/**
 * EUNA Pilot — run orchestration
 *
 * State machine for one agent run: prepare (Laravel signs the payload) →
 * stream (Python, SSE) → on tool events: consent gate → execute in the real
 * UI → continue the stream with tool results → … → commit (Laravel persists
 * the turn + audit rows).
 *
 * The consent gate is structural, not prompt-hoped: any batch containing
 * click/input/select is held at an explicit "Take the wheel" CTA until the
 * teacher approves. The executor independently refuses destructive confirm
 * controls regardless of this flag.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { streamEvents } from './streamClient';
import { executeBatch } from './executor';
import { buildElementSnapshot } from './elementSnapshot';
import * as overlay from './overlay';

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001';
const THREAD_KEY = 'euna-pilot-thread';
const THREAD_LIMIT = 40;

const ACTING_ACTIONS = new Set(['click', 'input', 'select']);

// Hard cap on tool round-trips inside one run — the last line of defense
// against a model stuck re-requesting data (the stop button remains the
// teacher's override at any moment)
const MAX_TOOL_TURNS = 8;

export const PILOT_SUGGESTIONS = [
    'Summarize my classes',
    'How do I remove a student?',
    'Show me who still has ungraded work',
    'Take me to the AI generation studio',
];

let msgSeq = 0;
const nextMsgId = () => `m${++msgSeq}-${Date.now()}`;

export function usePilotRun() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(THREAD_KEY) || '[]');
            return Array.isArray(saved) ? saved.slice(-THREAD_LIMIT) : [];
        } catch {
            return [];
        }
    });
    const [status, setStatus] = useState('idle'); // idle|thinking|awaiting-consent|acting
    const [statusText, setStatusText] = useState('');
    const [consent, setConsent] = useState(null); // {explain, commands} while pending
    const [input, setInput] = useState('');

    const busyRef = useRef(false);
    const abortRef = useRef(null); // one controller per RUN — stop must kill lookups too
    const abortedRef = useRef(false);
    const toolTurnsRef = useRef(0);
    const stopNoticeShownRef = useRef(false);
    const lastBatchKeyRef = useRef(null);
    const runIdRef = useRef(null);
    const turnTokenRef = useRef(null);
    const consentRef = useRef(false);
    const executedRef = useRef([]);
    const snapshotRef = useRef({ text: '', entries: new Map() });
    const messagesRef = useRef(messages);
    const streamingRef = useRef(null); // id of the euna message being streamed
    const pendingToolRef = useRef(null); // tool event held for the consent gate

    useEffect(() => {
        messagesRef.current = messages;
        try {
            localStorage.setItem(THREAD_KEY, JSON.stringify(messages.slice(-THREAD_LIMIT)));
        } catch { /* quota — the thread is ephemeral anyway */ }
    }, [messages]);

    useEffect(() => () => abortRef.current?.abort(), []);

    // Reload mid-run leaves a persisted user message with no answer — say so
    // instead of leaving a dangling question in the restored thread
    useEffect(() => {
        const msgs = messagesRef.current;
        const last = msgs[msgs.length - 1];
        if (last && last.kind === 'user') {
            setMessages((prev) => [
                ...prev,
                { id: nextMsgId(), kind: 'notice', text: '(The page was reloaded mid-run, so that last request never finished — ask me again.)' },
            ]);
        }
    }, []);

    const push = useCallback((msg) => {
        const withId = { id: nextMsgId(), ...msg };
        setMessages((prev) => [...prev, withId]);
        return withId.id;
    }, []);

    const updateMessage = useCallback((id, patch) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    }, []);

    const setStrip = useCallback((text) => {
        setStatusText(text || '');
    }, []);

    const takeSnapshot = useCallback(() => {
        const snap = buildElementSnapshot();
        snapshotRef.current = { text: snap.text, entries: new Map(snap.entries.map((e) => [e.ref, e])) };
        return snapshotRef.current;
    }, []);

    const streamDelta = useCallback((delta) => {
        const id = streamingRef.current;
        if (!id) return;
        setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, text: (m.text || '') + delta } : m))
        );
    }, []);

    const currentAnswer = useCallback(() => {
        if (!streamingRef.current) return '';
        const msg = messagesRef.current.find((m) => m.id === streamingRef.current);
        return msg?.text || '';
    }, []);

    const finalize = useCallback(
        async ({ answerNote = '' } = {}) => {
            // The stop notice lives here so EVERY abort path (stream drop,
            // lookup cancel, between-turns guard) lands in the same state
            if (abortedRef.current && !stopNoticeShownRef.current) {
                stopNoticeShownRef.current = true;
                push({ kind: 'notice', text: 'Stopped — your call. Say the word when you want me again.' });
            }
            const answer = (currentAnswer() + answerNote).trim();
            if (streamingRef.current) updateMessage(streamingRef.current, { streaming: false });
            streamingRef.current = null;
            overlay.hideHighlight();
            overlay.hideCursor();
            setStatus('idle');
            setStrip('');
            setConsent(null);
            pendingToolRef.current = null;
            busyRef.current = false;

            if (turnTokenRef.current) {
                const token = turnTokenRef.current;
                turnTokenRef.current = null;
                api.post('/teacher/ai/pilot-commit', {
                    turn_token: token,
                    answer,
                    executed_commands: executedRef.current.slice(-50),
                }).catch(() => {
                    // The audit trail is a selling point — never fail silent
                    push({ kind: 'notice', text: "(Heads up: I couldn't save this run's history — the backend hiccuped.)" });
                });
            }
        },
        [currentAnswer, updateMessage, setStrip]
    );

    /** One stream turn: Laravel signs → Python streams → we act on events. */
    const runTurn = useCallback(
        async (kind, { task, data } = {}) => {
            if (abortedRef.current) {
                await finalize();
                return;
            }

            let envelope;
            try {
                const resp = await api.post(
                    '/teacher/ai/pilot-prepare',
                    {
                        run_id: runIdRef.current,
                        kind,
                        route: window.location.pathname,
                        message: kind === 'start' ? task : undefined,
                        data: data || {},
                    },
                    { signal: abortRef.current?.signal, timeout: 20000 },
                );
                envelope = resp.data;
                turnTokenRef.current = envelope.turn_token;
            } catch (err) {
                if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
                    await finalize();
                    return;
                }
                push({ kind: 'notice', text: "I couldn't reach my coordinator — is the backend up?" });
                await finalize();
                return;
            }

            let pendingTool = null;
            let pendingLookup = null;

            try {
                const events = streamEvents(`${AI_SERVICE_URL}/ai/pilot-stream`, envelope, abortRef.current.signal);
                for await (const ev of events) {
                    switch (ev.type) {
                        case 'status':
                            setStrip(ev.text);
                            break;
                        case 'narration-delta':
                            if (!streamingRef.current) {
                                streamingRef.current = push({ kind: 'euna', text: '', streaming: true });
                            }
                            streamDelta(ev.delta);
                            break;
                        case 'tool':
                            pendingTool = ev;
                            break;
                        case 'lookup-request':
                            pendingLookup = ev;
                            break;
                        case 'error':
                            push({ kind: 'notice', text: ev.message || 'Something went wrong on my side.' });
                            break;
                        case 'finish':
                            if (ev.reason === 'error') setStrip('');
                            break;
                        default:
                            break;
                    }
                    if (pendingTool || pendingLookup) break; // the turn ends at a tool call
                }
            } catch (err) {
                if (err?.name === 'AbortError') {
                    await finalize();
                    return;
                }
                if (abortedRef.current) {
                    await finalize();
                    return;
                }
                push({ kind: 'notice', text: 'The AI service dropped mid-run — try again in a moment.' });
                await finalize({ answerNote: '\n\n(Connection dropped mid-run.)' });
                return;
            }

            if (abortedRef.current) {
                await finalize();
                return;
            }
            if (toolTurnsRef.current >= MAX_TOOL_TURNS) {
                push({ kind: 'notice', text: "I've been going back and forth too long on this one — let's break it into smaller asks. What you have so far stands." });
                await finalize();
                return;
            }

            if (pendingLookup) {
                await handleLookup(pendingLookup);
                return;
            }
            if (pendingTool) {
                await handleTool(pendingTool);
                return;
            }
            await finalize();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [push, streamDelta, setStrip, updateMessage, finalize, currentAnswer]
    );

    /** Execute a tool batch (post-consent or read-only) and continue. */
    const handleTool = useCallback(
        async (event) => {
            const commands = Array.isArray(event.commands) ? event.commands : [];
            const needsConsent = !consentRef.current && commands.some((c) => ACTING_ACTIONS.has(String(c.action)));

            if (needsConsent) {
                pendingToolRef.current = event;
                setStatus('awaiting-consent');
                setStrip('');
                setConsent({ explain: event.explain || '', commands });
                return;
            }

            setStatus('acting');
            setStrip(event.explain || 'Operating…');
            toolTurnsRef.current += 1;
            const toolsMsgId = push({
                kind: 'tools',
                explain: event.explain || '',
                // Resolve ref numbers to element names NOW — pending rows
                // should read 'Click "Overview"', not 'Click element 8'
                commands: commands.map((c) => ({
                    ...c,
                    label: c.ref != null ? snapshotRef.current.entries.get(Number(c.ref))?.name : undefined,
                })),
                results: null,
            });

            const ctx = {
                entries: snapshotRef.current.entries,
                snapshot: snapshotRef.current,
                buildSnapshot: takeSnapshot,
                batchExplain: event.explain || '',
                signal: abortRef.current?.signal, // Stop cuts the batch at the next command
            };
            const { results } = await executeBatch(commands, ctx);
            executedRef.current.push(...results.map((r) => ({ ...r, explain: event.explain || '' })));
            updateMessage(toolsMsgId, { results });

            // Repeat detection: an identical batch that just failed entirely
            // means the model is stuck — stop honestly instead of burning
            // the turn budget on the same mistake
            const batchKey = JSON.stringify(commands.map((c) => [c.action, c.ref ?? c.path ?? c.value ?? null]));
            const allFailed = results.length > 0 && results.every((r) => !r.ok);
            if (allFailed && batchKey === lastBatchKeyRef.current) {
                push({ kind: 'notice', text: "The same steps keep failing — I'm stopping rather than spinning. Want to rephrase or try a different route?" });
                await finalize();
                return;
            }
            lastBatchKeyRef.current = batchKey;

            if (streamingRef.current) updateMessage(streamingRef.current, { streaming: false });
            streamingRef.current = null;

            await runTurn('tool-result', {
                data: {
                    route: window.location.pathname,
                    snapshot: snapshotRef.current.text,
                    consent: consentRef.current,
                    explain: event.explain,
                    commands,
                    results: results.map((r) => ({
                        action: r.action,
                        ref: r.ref,
                        ok: r.ok,
                        blocked: r.blocked || undefined,
                        message: r.message,
                    })),
                },
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [push, updateMessage, runTurn, takeSnapshot]
    );

    /** Read-only data request, answered by Laravel with teacher-scoped policies. */
    const handleLookup = useCallback(
        async (event) => {
            setStatus('acting');
            setStrip(`Looking up ${event.query}…`);
            toolTurnsRef.current += 1;
            let result;
            try {
                const resp = await api.post(
                    '/teacher/ai/pilot-lookup',
                    { query: event.query, params: event.params || {} },
                    { signal: abortRef.current?.signal, timeout: 20000 },
                );
                result = resp.data;
            } catch (err) {
                if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || abortedRef.current) {
                    await finalize();
                    return;
                }
                result = { error: err?.response?.data?.error || 'lookup failed' };
            }

            if (abortedRef.current) {
                await finalize();
                return;
            }

            if (streamingRef.current) updateMessage(streamingRef.current, { streaming: false });
            streamingRef.current = null;

            await runTurn('lookup-result', {
                data: {
                    route: window.location.pathname,
                    query: event.query,
                    params: event.params || {},
                    result,
                },
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [updateMessage, runTurn]
    );

    const approveConsent = useCallback(async () => {
        const held = pendingToolRef.current;
        if (!held) return;
        // Stop wins over a late approve — never execute a batch the teacher
        // tried to cancel while the card was up
        if (abortedRef.current) {
            pendingToolRef.current = null;
            setConsent(null);
            await finalize();
            return;
        }
        consentRef.current = true;
        setConsent(null);
        pendingToolRef.current = null;
        await handleTool(held);
    }, [handleTool, finalize]);

    const declineConsent = useCallback(async () => {
        pendingToolRef.current = null;
        setConsent(null);
        push({ kind: 'notice', text: 'No problem — it stays in your hands. Anything else I can point out?' });
        await finalize({ answerNote: '\n\n(Teacher declined the takeover — stopped before operating.)' });
    }, [push, finalize]);

    const send = useCallback(
        async (rawText) => {
            const task = (typeof rawText === 'string' ? rawText : input)?.trim?.() ?? '';
            if (!task || busyRef.current) return;
            busyRef.current = true;
            setInput('');

            runIdRef.current = crypto.randomUUID();
            consentRef.current = false;
            executedRef.current = [];
            toolTurnsRef.current = 0;
            abortedRef.current = false;
            stopNoticeShownRef.current = false;
            lastBatchKeyRef.current = null;
            abortRef.current = new AbortController();
            takeSnapshot();

            push({ kind: 'user', text: task });
            setStatus('thinking');
            setStrip('Thinking…');

            await runTurn('start', { task, data: { snapshot: snapshotRef.current.text } });
        },
        [input, push, runTurn, takeSnapshot, setStrip]
    );

    const abort = useCallback(() => {
        abortedRef.current = true;
        // A stop while the consent card is up means "cancel that" — the held
        // batch must die with it, not wait for a late approve
        pendingToolRef.current = null;
        setConsent(null);
        abortRef.current?.abort();
    }, []);

    const clearThread = useCallback(() => {
        abort();
        setMessages([]);
        setStatus('idle');
        setStatusText('');
        setConsent(null);
        try {
            localStorage.removeItem(THREAD_KEY);
        } catch { /* ignore */ }
    }, []);

    return {
        open,
        setOpen,
        messages,
        status,
        statusText,
        consent,
        input,
        setInput,
        send,
        approveConsent,
        declineConsent,
        abort,
        clearThread,
        suggestions: PILOT_SUGGESTIONS,
        busy: status !== 'idle',
    };
}
