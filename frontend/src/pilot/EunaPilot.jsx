import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Sparkles, Square, X, Ban, TriangleAlert, MousePointerClick } from 'lucide-react';
import { usePilotRun } from './usePilotRun';
import { scrubRefs } from './textUtils';
import { pilotNavigate } from './bridge';
import './pilot.css';

// EUNA's actual portrait — the same art the landing chatbot wears.
function EunaAvatar({ size = 24, className = '' }) {
    return (
        <img
            className={`euna-avatar ${className}`.trim()}
            src="/euna/euna_profile.png"
            alt=""
            width={size}
            height={size}
            draggable="false"
        />
    );
}

const STATUS_LINE = {
    idle: 'Ready',
    thinking: 'Thinking…',
    acting: 'Driving…',
    'awaiting-consent': 'Waiting for your OK',
};

const ACTION_LABEL = {
    goto: 'Go to', click: 'Click', hover: 'Point at', point: 'Point at',
    input: 'Type into', select: 'Choose in', scroll: 'Scroll', snapshot: 'Read page',
};

function describeCommand(c) {
    const label = ACTION_LABEL[c.action] || c.action;
    // Prefer the resolved element name — teachers can't act on ref numbers.
    // For input/select the value rides parenthetically; the field is the news.
    const isFill = c.action === 'input' || c.action === 'select';
    const target = c.label
        ? `"${c.label}"${isFill && c.value ? ` — "${c.value}"` : ''}`
        : c.value
            ? `"${c.value}"`
            : c.ref != null
                ? `element ${c.ref}`
                : '';
    return `${label} ${target}`.trim();
}

// Tiny rich-text pass for EUNA's narration: **bold**, *italic*, `inline
// code`, markdown pipe tables (she compares data in them), and dashboard
// links [label](/dashboard/…) which navigate the SPA in place. Refs are
// scrubbed first so internal ids never reach the teacher's eyes.
function renderInline(text, keyBase) {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\(\/[^)]+\))/g;
    let last = 0;
    let key = keyBase;
    let m;
    while ((m = re.exec(text))) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        const tok = m[0];
        if (tok.startsWith('**')) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
        else if (tok.startsWith('*')) parts.push(<em key={key++}>{tok.slice(1, -1)}</em>);
        else if (tok.startsWith('`')) parts.push(<code key={key++} className="euna-inline-code">{tok.slice(1, -1)}</code>);
        else {
            const link = tok.match(/^\[([^\]]+)\]\((\/[^)]+)\)$/);
            if (link) {
                parts.push(
                    <a
                        key={key++}
                        className="euna-msg__link"
                        href={link[2]}
                        onClick={(e) => { e.preventDefault(); pilotNavigate(link[2]); }}
                    >
                        {link[1]}
                    </a>
                );
            } else parts.push(tok);
        }
        last = m.index + tok.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
}

function renderRich(text, onOption) {
    const clean = scrubRefs(text);
    const lines = clean.split('\n');
    const isTableRow = (l) => /^\s*\|.*\|\s*$/.test(l);
    const isSeparator = (l) => /^\s*\|[\s:|-]+\|\s*$/.test(l);
    const isBullet = (l) => /^\s*[-*•]\s+/.test(l);
    const isNumbered = (l) => /^\s*\d+[.)]\s+/.test(l);
    const out = [];
    let key = 0;
    let plain = [];
    const flushPlain = () => {
        if (!plain.length) return;
        out.push(...renderInline(plain.join('\n'), key));
        key += Math.max(plain.length, 1);
        plain = [];
    };
    for (let i = 0; i < lines.length; i++) {
        // The model glues the table's header to the intro sentence ("…the
        // rundown: | Class | … |") and the following prose to the last row
        // ("| test | 0 | 0 | So, …"). Split those grafts so a real table
        // renders instead of raw pipes.
        if (
            !isTableRow(lines[i]) &&
            lines[i].includes('|') &&
            i + 1 < lines.length &&
            isSeparator(lines[i + 1])
        ) {
            const cut = lines[i].indexOf('|');
            plain.push(lines[i].slice(0, cut).trimEnd());
            lines[i] = lines[i].slice(cut);
        }
        if (isTableRow(lines[i])) {
            const block = [];
            let j = i;
            while (j < lines.length) {
                const l = lines[j];
                if (isTableRow(l)) {
                    block.push(l);
                    j += 1;
                    continue;
                }
                if (l.trim().startsWith('|')) {
                    // "| row… | trailing prose" — cut at the last pipe; the
                    // tail rejoins the prose stream on the next pass
                    const lastPipe = l.lastIndexOf('|');
                    const head = l.slice(0, lastPipe + 1);
                    if (isTableRow(head)) {
                        block.push(head);
                        lines[j] = l.slice(lastPipe + 1).trim();
                        if (!lines[j]) j += 1;
                    }
                }
                break;
            }
            i = j - 1;
            const rows = block
                .filter((l) => !isSeparator(l))
                .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
            if (rows.length >= 2) {
                flushPlain();
                out.push(
                    // The wrapper scrolls, not the panel — a wide table must
                    // never blow out the chat's width.
                    <div className="euna-msg__tablewrap" key={`tw${key++}`}>
                        <table className="euna-msg__table">
                            <thead>
                                <tr>
                                    {rows[0].map((c, ci) => <th key={ci}>{renderInline(c, 10000 + ci)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.slice(1).map((r, ri) => (
                                    <tr key={ri}>
                                        {r.map((c, ci) => <td key={ci}>{renderInline(c, 20000 + ri * 40 + ci)}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            } else {
                plain.push(...block);
            }
        } else if (isBullet(lines[i]) || isNumbered(lines[i])) {
            // Consecutive "- item" / "1. item" lines become REAL list
            // elements — raw dashes with pre-wrap read as a wall of text.
            // Immediately after a "Question:" line they're answer OPTIONS:
            // they render as tappable cards that send the choice back.
            const ask = ASK_LABEL_RE.exec(lines[i - 1] || '');
            const optMatch = ASK_OPTION_RE.exec(lines[i]);
            if (ask && optMatch) {
                const options = [];
                while (i < lines.length) {
                    const m = ASK_OPTION_RE.exec(lines[i]);
                    if (!m) break;
                    options.push(m[1]);
                    i++;
                }
                i--;
                // The "Question:" line already went to `plain` — drop it and
                // emit the ask card (question + options) in its place.
                plain.pop();
                flushPlain();
                out.push(renderAskBlock(ask[1], options, key++, onOption));
                continue;
            }
            const ordered = isNumbered(lines[i]);
            const items = [];
            while (
                i < lines.length &&
                (ordered ? isNumbered(lines[i]) : isBullet(lines[i]))
            ) {
                items.push(lines[i++].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''));
            }
            i--;
            flushPlain();
            const ListTag = ordered ? 'ol' : 'ul';
            out.push(
                <ListTag className={`euna-msg__list ${ordered ? 'euna-msg__list--num' : ''}`} key={`l${key++}`}>
                    {items.map((item, ii) => (
                        <li key={ii}>{renderInline(item, 30000 + key * 40 + ii)}</li>
                    ))}
                </ListTag>
            );
        } else {
            plain.push(lines[i]);
        }
    }
    flushPlain();
    return out;
}

// An "ask block" turns EUNA's clarifying questions into tappable options
// (the Claude/ZCode pattern): a "Question:" line followed by "- option"
// or "1. option" lines renders as buttons instead of plain text.
const ASK_LABEL_RE = /^\s*(?:question|q)\s*[:：]\s*(.+)$/i;
const ASK_OPTION_RE = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;

function renderAskBlock(question, options, key, onOption) {
    return (
        <div className="euna-ask" key={`ask${key}`}>
            <p className="euna-ask__q">{renderInline(question, 40000 + key)}</p>
            <div className="euna-ask__options">
                {options.map((opt, oi) => (
                    <button
                        type="button"
                        className="euna-ask__option"
                        key={oi}
                        onClick={() => onOption(opt)}
                    >
                        <span>{renderInline(opt, 41000 + key * 20 + oi)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function StepRow({ c, result }) {
    // Once executed, the row says what actually happened ("Clicked "Create
    // Class"") — the raw command shape is only for the pending state.
    const text = result?.message
        ? result.message.replace(/^BLOCKED:\s*/, '')
        : describeCommand(c);
    return (
        <li className={`euna-step ${result ? (result.ok ? 'is-ok' : 'is-fail') : 'is-pending'}`}>
            {!result ? (
                <Loader2 size={13} className="euna-spin" />
            ) : result.blocked ? (
                <Ban size={13} />
            ) : result.ok ? (
                <Check size={13} />
            ) : (
                <X size={13} />
            )}
            <span>{text}</span>
        </li>
    );
}

/** The floating status pill: "EUNA is driving / Waiting for your OK".
 *  Lifetime is keyed on the whole busy run (status !== 'idle') so it stays
 *  put while EUNA thinks between batches — it used to drop for that stretch
 *  and read as "it stopped". `pending` keeps it mounted through the pause,
 *  then it plays a deliberate exit. */
function DriveBar({ label, step, waiting, leaving, pending, onOpen, onStop }) {
    // Two-phase unmount: starts hidden (a fresh page load shows no pill
    // until there's something to report), the leave animation owns removal.
    const [unmounted, setUnmounted] = useState(!pending);
    useEffect(() => {
        if (pending) return undefined;
        const t = setTimeout(() => setUnmounted(true), leaving ? 240 : 0);
        return () => clearTimeout(t);
    }, [pending, leaving]);
    if (!pending && unmounted) return null;
    return (
        <div
            className={`euna-drive-bar ${waiting && !leaving ? 'is-waiting' : ''} ${leaving ? 'is-leaving' : ''}`}
            role="status"
        >
            <EunaAvatar size={24} className="euna-drive-bar__avatar" />
            <span className="euna-drive-bar__dot" />
            <button type="button" className="euna-drive-bar__main" title="Open EUNA Pilot" onClick={onOpen}>
                <span className="euna-drive-bar__label">{label}</span>
                {step && <span className="euna-drive-bar__step">{step}</span>}
            </button>
            <button type="button" className="euna-drive-bar__stop" onClick={onStop}>
                <Square size={11} />
                Stop
            </button>
        </div>
    );
}

function StepsCard({ msg }) {
    return (
        <div className="euna-steps">
            {msg.explain && <p className="euna-steps__lead">{msg.explain}</p>}
            <ul className="euna-steps__list">
                {msg.commands.map((c, i) => <StepRow key={i} c={c} result={msg.results?.[i]} />)}
            </ul>
        </div>
    );
}

export default function EunaPilot() {
    const pilot = usePilotRun();
    const { open, setOpen, messages, status, statusText, driving, droveThisRun, consent, input, setInput, send, approveConsent, declineConsent, abort, clearThread, suggestions, busy } = pilot;
    const scrollRef = useRef(null);
    const inputRef = useRef(null);
    const stickRef = useRef(true);

    // Chat-rule scrolling: follow the latest message while the teacher is at
    // (or near) the bottom; never yank them back while they've scrolled up to
    // read. The stick decision is made by the teacher's OWN scroll events —
    // the old approach re-checked "nearBottom" after the new content had
    // already rendered, so any appended message taller than the tolerance
    // silently broke the follow.
    const handleBodyScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (el && stickRef.current) el.scrollTop = el.scrollHeight;
    }, [messages, statusText, status, consent]);

    // Focus the composer when the panel opens; Escape closes it. Opening
    // mid-run also re-arms the follow so the teacher lands on the latest.
    useEffect(() => {
        if (!open) return;
        inputRef.current?.focus();
        stickRef.current = true;
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, setOpen]);

    // Sending is the teacher speaking from the bottom of the thread — always
    // re-arm the follow so their own message and the reply stay in view
    const sendAndFollow = (text) => {
        stickRef.current = true;
        send(text);
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAndFollow();
        }
    };

    const waiting = status === 'awaiting-consent';
    const statusLine = STATUS_LINE[status] || 'Ready';
    // The pill lives for the whole run once EUNA has actually taken the
    // wheel — pure data lookups never show it ("driving" while checking
    // grades read as a bug). It also holds through the thinking gaps between
    // driving batches instead of blinking out.
    const wheelRun = droveThisRun && busy;
    const barPending = driving || waiting || wheelRun;
    const leaving = (driving || waiting || wheelRun) && !barPending;
    const barLabel = waiting ? 'Waiting for your OK' : 'EUNA is driving';
    const barStep = waiting ? consent?.explain : (statusText || 'Working…');
    const placeholder = !busy
        ? 'Ask me to show, tell, or do…'
        : waiting
            ? 'Your call — take the wheel, or stop me…'
            : driving
                ? 'EUNA is driving…'
                : 'Working…';
    const typingLabel =
        status === 'thinking'
            ? 'Thinking'
            : (statusText || 'Checking the page').replace(/…+$/, '');

    return (
        <div className="euna-root" data-euna-ignore>
            {/* Driving owns the page: the bar, the blue corner glow and the
                click lock all appear together, and chatting or thinking never
                shows them. Waiting for consent shows the bar (with Stop) but
                NOT the lock — the teacher's page stays theirs until they
                approve. The lock blocks real pointers — the executor drives
                through programmatic clicks and the panel (9990) + bar (9987)
                + FAB (9985) all sit above it. */}
            {driving && <div className="euna-driving-blocker" aria-hidden="true" />}
            {driving && <div className="euna-driving-glow" aria-hidden="true" />}

            <DriveBar
                label={barLabel}
                step={barStep}
                waiting={waiting}
                leaving={leaving}
                pending={barPending}
                onOpen={() => setOpen(true)}
                onStop={abort}
            />

            {/* Consent with the panel closed still needs an answer — pulse the
                FAB so the takeover request is never missed */}
            {waiting && !open && <span className="euna-fab__badge" aria-hidden="true" />}

            {open && (
                <section className="euna-panel" aria-label="EUNA Pilot">
                    <header className="euna-panel__head">
                        <EunaAvatar size={32} className="euna-panel__avatar" />
                        <div className="euna-panel__titles">
                            <strong>EUNA Pilot</strong>
                            <span className={`euna-panel__status ${status !== 'idle' ? 'is-live' : ''}`}>
                                <span className="euna-panel__status-dot" />
                                {statusLine}
                            </span>
                        </div>
                        <button className="euna-iconbtn" aria-label="New chat" title="New chat" onClick={clearThread} disabled={busy}>
                            <Sparkles size={15} />
                        </button>
                        <button className="euna-iconbtn" aria-label="Close" title="Close" onClick={() => setOpen(false)}>
                            <X size={16} />
                        </button>
                    </header>

                    <div className="euna-panel__body euna-scrollbar" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="euna-empty">
                                <EunaAvatar size={56} className="euna-empty__avatar" />
                                <p className="euna-empty__hi">Hi, I'm EUNA ~</p>
                                <p className="euna-empty__sub">
                                    I can show you around, answer questions about your
                                    classes, and drive pages for you — with your OK.
                                    Lesson content stays with the AI Studio.
                                </p>
                            </div>
                        )}

                        {messages.map((m) => {
                            if (m.kind === 'user') {
                                return <div key={m.id} className="euna-msg euna-msg--user">{m.text}</div>;
                            }
                            if (m.kind === 'euna') {
                                return (
                                    <div key={m.id} className="euna-msg euna-msg--euna">
                                        <EunaAvatar size={24} className="euna-msg__avatar" />
                                        <div className={`euna-msg__text ${m.streaming ? 'is-streaming' : ''}`}>{renderRich(m.text, sendAndFollow)}</div>
                                    </div>
                                );
                            }
                            if (m.kind === 'tools') return <StepsCard key={m.id} msg={m} />;
                            if (m.kind === 'notice') {
                                return (
                                    <div key={m.id} className="euna-notice">
                                        <TriangleAlert size={13} />
                                        <span>{m.text}</span>
                                    </div>
                                );
                            }
                            return null;
                        })}

                        {/* The "someone is typing" bubble — while EUNA thinks
                            or checks, and NOT while narration is already
                            streaming (the live caret covers that) */}
                        {(status === 'thinking' || status === 'acting') &&
                         !messages.some((m) => m.streaming) && (
                            <div className="euna-msg euna-msg--euna">
                                <EunaAvatar size={24} className="euna-msg__avatar" />
                                <span className="euna-msg__text euna-typing">
                                    {typingLabel}
                                    <span className="euna-typing__dots" aria-hidden="true">
                                        <i /><i /><i />
                                    </span>
                                </span>
                            </div>
                        )}

                        {consent && (
                            <div className="euna-consent">
                                <p className="euna-consent__title">
                                    <MousePointerClick size={14} />
                                    Want me to take the wheel?
                                </p>
                                <p className="euna-consent__explain">{consent.explain || 'I\'m ready to operate the page for you.'}</p>
                                <p className="euna-consent__note">
                                    Every step gets narrated. Destructive confirmations stay yours to press.
                                </p>
                                <div className="euna-consent__row">
                                    <button className="euna-btn euna-btn--primary" onClick={approveConsent}>
                                        Take the wheel
                                    </button>
                                    <button className="euna-btn" onClick={declineConsent}>
                                        I'll do it
                                    </button>
                                </div>
                            </div>
                        )}

                        {messages.length === 0 && (
                            <div className="euna-chips">
                                {suggestions.map((s) => (
                                    <button key={s} className="euna-chip" onClick={() => sendAndFollow(s)} disabled={busy}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <footer className="euna-panel__input">
                        <div className="euna-composer">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKey}
                                placeholder={placeholder}
                                disabled={busy}
                                rows={1}
                            />
                            {busy ? (
                                <button className="euna-send euna-send--stop" title="Stop" onClick={abort}>
                                    <Square size={13} />
                                </button>
                            ) : (
                                <button className="euna-send" title="Send" onClick={() => sendAndFollow()} disabled={!input.trim()}>
                                    <Sparkles size={14} />
                                </button>
                            )}
                        </div>
                    </footer>
                </section>
            )}

            <button
                className={`euna-fab ${open ? 'is-open' : ''}`}
                title="Ask EUNA"
                aria-label="Ask EUNA"
                onClick={() => setOpen(!open)}
            >
                <EunaAvatar size={52} />
            </button>
        </div>
    );
}
