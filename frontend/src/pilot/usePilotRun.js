/**
 * EUNA Pilot — run orchestration
 *
 * State machine for one agent run: prepare (Laravel signs the payload) →
 * stream (Python, SSE) → on tool events: consent gate → execute in the real
 * UI → continue the stream with tool results → … → commit (Laravel persists
 * the turn + audit rows).
 *
 * The consent gate is structural, not prompt-hoped: any batch that moves or
 * changes the page — navigation (goto) included — is held at an explicit
 * "Take the wheel" CTA until the teacher approves. The executor
 * independently refuses destructive confirm controls regardless of this
 * flag.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { streamEvents } from './streamClient';
import { executeBatch } from './executor';
import { buildElementSnapshot } from './elementSnapshot';
import { scrubRefs } from './textUtils';
import * as overlay from './overlay';

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001';
const THREAD_KEY = 'euna-pilot-thread';
const THREAD_LIMIT = 40;

// Actions that move or change the page — the teacher's "take the wheel" set.
// goto is in deliberately: navigating the teacher somewhere uninvited IS
// driving, even if nothing is clicked (the section-B report). Point/hover/
// snapshot/scroll stay free — they guide and read without moving anyone.
const ACTING_ACTIONS = new Set(['click', 'input', 'select', 'goto']);
// Batches made ONLY of these are invisible reads — they run without the
// takeover UI (no bar/glow/lock); a "Read page" row still lands in the thread.
const SILENT_ACTIONS = new Set(['snapshot', 'hover', 'point']);

// Teacher-facing words for the status strip while a lookup runs — the raw
// query names ("get_student_grades") are plumbing, not speech.
const LOOKUP_LABELS = {
    list_classes: 'your classes',
    class_summary: 'the class summary',
    class_performance: 'student rankings',
    search_students: 'your student roster',
    get_student_grades: 'scores',
};

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

// Turns are stateless — without this the model forgets lookup data the
// moment a goto happens and starts inventing numbers. Lookup results ride
// in the trail as compact digests so every later turn still has the facts.
function lookupDigest(query, result) {
    try {
        if (query === 'list_classes' && Array.isArray(result)) {
            return result
                .map((c) => `${c.name}: ${c.students_count ?? '?'} students, ${c.ungraded_submissions ?? '?'} ungraded`)
                .join(' | ')
                .slice(0, 300);
        }
        if (query === 'class_summary' && result && !result.error) {
            return `${result.class?.name ?? 'class'}: ${result.students} students, ${result.ungraded_submissions} ungraded`;
        }
        if (query === 'class_performance' && result && !result.error) {
            const rows = (result.classes || []).map((c) => {
                const top = (c.ranked || []).slice(0, 3).map((r) => `${r.name} ${r.avg_pct}%`).join(', ');
                return `${c.class}: ${top || c.note || 'no graded work'}`;
            });
            return rows.join(' | ').slice(0, 300);
        }
        if (query === 'search_students' && Array.isArray(result)) {
            const names = result.map((s) => `${s.name} (id ${s.student_id})`).join(', ');
            return names ? `found: ${names}`.slice(0, 300) : 'no matches';
        }
        if (query === 'get_student_grades' && result && !result.error) {
            const acts = (result.activities || []).map((a) => `${a.activity}: ${a.score ?? '—'}/${a.max}`).join('; ');
            const qz = (result.quizzes || []).map((q) => `${q.quiz}: ${q.score}/${q.max}`).join('; ');
            return `${result.student?.name ?? 'student'} — activities: ${acts || 'none'} · quizzes: ${qz || 'none'}`.slice(0, 300);
        }
        const s = JSON.stringify(result ?? {});
        return s.length > 200 ? `${s.slice(0, 200)}…` : s;
    } catch {
        return 'data received';
    }
}

// The model sometimes narrates an action ("I'm opening the class page…",
// "I'll explain how removal works…") and stops without sending any tool
// call or delivering the promised words. Claim-based detection, not a verb
// whitelist — the net must not care WHICH action was claimed, and a
// trailing question must not launder a false claim made mid-message.
const ACTION_CLAIM_RE =
    /\b(?:i'?ll|i\s+will|i'?m|i\s+am|let'?s|let\s+me|we'?ll|we\s+are\s+going\s+to|going\s+to)\s+(?:go|head|open|take|bring|show|pull|navigate|jump|click|check|explain|describe|walk|break|look|search|set\s+up|create|delete|remove|grade|start|run|find|get|give|list|summarize|pull\s+up|point|show\s+you)\b/i;

// Conditional offers ("if you name the class I'll open it", "say the word
// and I'll pull it up") are the model asking for input — NOT claims about
// the current turn. Testing sentence-by-sentence with a conditional cue
// keeps the genuine mid-message claims ("I'm opening the class page — which
// one?") while killing the offer noise that nudged ~every chatty turn.
// Only the LAST TWO fragments are tested: real dangling claims sit where
// the model stopped, while capability menus and quoted examples (also full
// of "I'll check...") ride mid-message.
const CLAIM_CONDITIONAL_RE =
    /\b(?:if|when|once|want\s+me\s+to|shall\s+i|would\s+you\s+like|say\s+(?:the\s+word|so|go)|just\s+(?:say|name|tell|give|pick)|give\s+me|name\s+(?:the|a|which|one)|pick\s+(?:one|a)|make\s+me\s+a|let\s+me\s+know|tell\s+me\s+(?:which|who|what)|take\s+(?:that|it)\s+as)\b/i;

function hasDanglingClaim(narration) {
    const fragments = String(narration || '')
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(-2);
    return fragments.some(
        (s) => ACTION_CLAIM_RE.test(s) && !CLAIM_CONDITIONAL_RE.test(s)
    );
}

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
    const [driving, setDriving] = useState(false); // executing page actions — gates the drive bar + page lock
    const [consent, setConsent] = useState(null); // {explain, commands} while pending
    const [input, setInput] = useState('');

    const busyRef = useRef(false);
    const abortRef = useRef(null); // one controller per RUN — stop must kill lookups too
    const abortedRef = useRef(false);
    const toolTurnsRef = useRef(0);
    const stopNoticeShownRef = useRef(false);
    const lastBatchKeyRef = useRef(null);
    const taskRef = useRef('');
    const runIdRef = useRef(null);
    const turnTokenRef = useRef(null);
    const consentRef = useRef(false);
    const executedRef = useRef([]);
    // Per-run memory of everything already done — lookups and batches ride
    // back to the model as RECENT ACTIONS so it can't re-ask for data it
    // already has (each stream turn is otherwise stateless)
    const trailRef = useRef([]);
    const lookupCacheRef = useRef(new Map());
    // Consecutive failed lookups — three in a row means the model is
    // thrashing ids/params; the next one is served an error that tells it
    // to stop querying and ask the teacher instead
    const failedLookupStreakRef = useRef(0);
    const nudgeUsedRef = useRef(false);
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
            setDriving(false);
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
                    answer: scrubRefs(answer),
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

            let envelope = null;
            const maxAttempts = 3;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
                    break;
                } catch (err) {
                    if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
                        await finalize();
                        return;
                    }
                    // This box serves the dashboard AND the pilot from one PHP
                    // worker — transient refusals right after an in-page action
                    // (the page's own writes are still draining) are common.
                    // A mid-run drop must not look like the task failed, so
                    // retry with backoff before giving up.
                    if (abortedRef.current) {
                        await finalize();
                        return;
                    }
                    if (attempt < maxAttempts) {
                        await new Promise((r) => setTimeout(r, 1200 * attempt));
                        continue;
                    }
                    push({
                        kind: 'notice',
                        text: kind === 'start'
                            ? "I couldn't reach the dashboard backend — is it running?"
                            : "The connection dropped on my side — every step you saw complete DID go through. Ask me to continue if the page doesn't look right.",
                    });
                    await finalize();
                    return;
                }
            }
            turnTokenRef.current = envelope.turn_token;

            let pendingTool = null;
            let pendingLookup = null;
            let turnNarration = '';
            let finishReason = null;

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
                            turnNarration += ev.delta;
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
                            finishReason = ev.reason;
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

            // Dangling-claim backstop: the turn claimed an action ("I'm
            // opening the class page…", "I'll explain how removal works…")
            // but finished with no tool call and didn't deliver the words.
            // A trailing question does NOT launder a claim made mid-message;
            // conditional offers ("say the word and I'll…") are not claims.
            // First offense → one continuation ordering act-or-ask. If it
            // happens AGAIN, end with an honest visible handoff instead of
            // leaving a false "done" on screen.
            const narratedVoidAction =
                finishReason === 'stop' &&
                !pendingTool &&
                !pendingLookup &&
                hasDanglingClaim(turnNarration);
            if (narratedVoidAction && !nudgeUsedRef.current) {
                nudgeUsedRef.current = true;
                // The nudge is a NEW turn of its own — close the finished
                // turn's bubble first, or its narration appends onto the
                // previous reply (two answers glued into one bubble).
                if (streamingRef.current) updateMessage(streamingRef.current, { streaming: false });
                streamingRef.current = null;
                await runTurn('tool-result', {
                    data: {
                        route: window.location.pathname,
                        task: taskRef.current,
                        snapshot: snapshotRef.current.text,
                        results: [],
                        nudge: true,
                        recent_calls: trailRef.current.slice(-10),
                    },
                });
                return;
            }
            if (narratedVoidAction && nudgeUsedRef.current) {
                push({
                    kind: 'notice',
                    text: "(I said I'd do that but couldn't complete it — say \"go on\" and I'll actually do it.)",
                });
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
            // Takeover UI only when the batch actually moves the page — a
            // point-at-controls guide or a snapshot never locks the teacher out
            const takesOver = commands.some((c) => !SILENT_ACTIONS.has(String(c.action)));
            if (takesOver) setDriving(true);
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
            trailRef.current.push(...results.map((r) => r.message).filter(Boolean));
            updateMessage(toolsMsgId, { results });
            // Batch done — the page is the teacher's again while the next
            // turn streams (the drive bar + page lock are tied to `driving`)
            if (takesOver) setDriving(false);
            setStatus('thinking');
            setStrip('');

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
                    task: taskRef.current,
                    snapshot: snapshotRef.current.text,
                    consent: consentRef.current,
                    explain: event.explain,
                    commands,
                    recent_calls: trailRef.current.slice(-10),
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

    /** Read-only data request, answered by Laravel with teacher-scoped policies.
     *  An identical repeat inside one run is served from cache with a repeat
     *  flag — the deterministic backstop for model lookup loops. */
    const handleLookup = useCallback(
        async (event) => {
            setStatus('acting');
            setStrip(`Checking ${LOOKUP_LABELS[event.query] || 'your data'}…`);
            toolTurnsRef.current += 1;

            const cacheKey = `${event.query}|${JSON.stringify(event.params || {}, Object.keys(event.params || {}).sort())}`;
            const isRepeat = lookupCacheRef.current.has(cacheKey);
            const streakBreached = failedLookupStreakRef.current >= 2;
            let result;
            if (streakBreached) {
                result = { error: 'repeated lookup failures — the model should stop querying' };
                trailRef.current.push('lookup abandoned after repeated failures');
            } else if (isRepeat) {
                result = lookupCacheRef.current.get(cacheKey);
                trailRef.current.push('repeat lookup — served the SAME cached data');
            } else {
                try {
                    const resp = await api.post(
                        '/teacher/ai/pilot-lookup',
                        { query: event.query, params: event.params || {} },
                        { signal: abortRef.current?.signal, timeout: 20000 },
                    );
                    result = resp.data;
                    failedLookupStreakRef.current = 0;
                    lookupCacheRef.current.set(cacheKey, result);
                } catch (err) {
                    if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || abortedRef.current) {
                        await finalize();
                        return;
                    }
                    result = { error: err?.response?.data?.error || 'lookup failed' };
                    failedLookupStreakRef.current += 1;
                    lookupCacheRef.current.set(cacheKey, result);
                }
                trailRef.current.push(`lookup ${event.query} — ${lookupDigest(event.query, result)}`);
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
                    task: taskRef.current,
                    query: event.query,
                    params: event.params || {},
                    result,
                    repeated: isRepeat && !streakBreached ? true : undefined,
                    failed_streak: streakBreached || undefined,
                    recent_calls: trailRef.current.slice(-10),
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
            taskRef.current = task;
            consentRef.current = false;
            executedRef.current = [];
            toolTurnsRef.current = 0;
            abortedRef.current = false;
            stopNoticeShownRef.current = false;
            lastBatchKeyRef.current = null;
            trailRef.current = [];
            lookupCacheRef.current = new Map();
            failedLookupStreakRef.current = 0;
            nudgeUsedRef.current = false;
            abortRef.current = new AbortController();
            takeSnapshot();

            push({ kind: 'user', text: task });
            setStatus('thinking');
            setStrip('Thinking…');

            await runTurn('start', { task, data: { snapshot: snapshotRef.current.text } });
        },
        [input, push, runTurn, takeSnapshot, setStrip]
    );

    const abort = useCallback(async () => {
        abortedRef.current = true;
        pendingToolRef.current = null;
        setConsent(null);
        abortRef.current?.abort();
        // During the consent wait NOTHING is in flight to observe the abort —
        // the stream loop already exited at the tool event and handleTool is
        // parked. finalize() here is the only exit; it's idempotent for the
        // in-flight case (the AbortError path lands in the same state).
        await finalize();
    }, [finalize]);

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
        driving,
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
