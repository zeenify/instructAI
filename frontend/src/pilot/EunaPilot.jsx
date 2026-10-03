import { useEffect, useRef } from 'react';
import { Check, Loader2, Sparkles, Square, X, Ban, TriangleAlert, MousePointerClick } from 'lucide-react';
import { usePilotRun } from './usePilotRun';
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

// Tiny rich-text pass for EUNA's narration: **bold** and `inline code`.
function renderRich(text) {
    const parts = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0;
    let key = 0;
    let m;
    while ((m = re.exec(text))) {
        if (m.index > last) parts.push(text.slice(last, m.index));
        const tok = m[0];
        if (tok.startsWith('**')) parts.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
        else parts.push(<code key={key++} className="euna-inline-code">{tok.slice(1, -1)}</code>);
        last = m.index + tok.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
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
    const { open, setOpen, messages, status, statusText, consent, input, setInput, send, approveConsent, declineConsent, abort, clearThread, suggestions, busy } = pilot;
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    // Stick to the bottom only while the teacher is already reading the
    // latest — never yank them back while they scroll up mid-narration
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
        if (nearBottom) el.scrollTop = el.scrollHeight;
    }, [messages, statusText, consent]);

    // Focus the composer when the panel opens; Escape closes it
    useEffect(() => {
        if (!open) return;
        inputRef.current?.focus();
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, setOpen]);

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const waiting = status === 'awaiting-consent';
    const statusLine = STATUS_LINE[status] || 'Ready';
    const placeholder = !busy
        ? 'Ask me to show, tell, or do…'
        : waiting
            ? 'Your call — take the wheel, or stop me…'
            : 'EUNA is driving…';

    return (
        <div className="euna-root" data-euna-ignore>
            {busy && (
                <div className={`euna-drive-bar ${waiting ? 'is-waiting' : ''}`} role="status">
                    <EunaAvatar size={24} className="euna-drive-bar__avatar" />
                    <span className="euna-drive-bar__dot" />
                    <button
                        type="button"
                        className="euna-drive-bar__main"
                        title="Open EUNA Pilot"
                        onClick={() => setOpen(true)}
                    >
                        <span className="euna-drive-bar__label">{waiting ? 'Waiting for your OK' : 'EUNA is driving'}</span>
                        {!waiting && statusText && statusText !== 'Thinking…' && (
                            <span className="euna-drive-bar__step">{statusText}</span>
                        )}
                    </button>
                    <button type="button" className="euna-drive-bar__stop" onClick={abort}>
                        <Square size={11} />
                        Stop
                    </button>
                </div>
            )}

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
                                        <span className={`euna-msg__text ${m.streaming ? 'is-streaming' : ''}`}>{renderRich(m.text)}</span>
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
                                    <button key={s} className="euna-chip" onClick={() => send(s)} disabled={busy}>
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
                                <button className="euna-send" title="Send" onClick={() => send()} disabled={!input.trim()}>
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
