import { useEffect, useRef } from 'react';
import { Check, Loader2, Sparkles, Square, X, Ban, TriangleAlert, MousePointerClick } from 'lucide-react';
import { usePilotRun } from './usePilotRun';
import './pilot.css';

function OwlMark({ size = 20 }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
            <circle cx="8.5" cy="11" r="3.2" fill="currentColor" />
            <circle cx="15.5" cy="11" r="3.2" fill="currentColor" />
            <circle cx="8.5" cy="11" r="1.2" fill="#fff" />
            <circle cx="15.5" cy="11" r="1.2" fill="#fff" />
            <path d="M10.5 15.6 L12 17.2 L13.5 15.6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path d="M4 8 C5 5.4 8 4.6 12 4.6 C16 4.6 19 5.4 20 8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
    );
}

const ACTION_LABEL = {
    goto: 'Go to', click: 'Click', hover: 'Point at', point: 'Point at',
    input: 'Type in', select: 'Choose in', scroll: 'Scroll', snapshot: 'Read page',
};

function describeCommand(c) {
    const label = ACTION_LABEL[c.action] || c.action;
    const target = c.value ? `"${c.value}"` : c.ref ? `element ${c.ref}` : '';
    return `${label} ${target}`.trim();
}

function ToolCard({ msg }) {
    return (
        <div className="euna-msg euna-tools">
            {msg.explain && <p className="euna-tools__explain">{msg.explain}</p>}
            <ul className="euna-tools__list">
                {msg.commands.map((c, i) => {
                    const r = msg.results?.[i];
                    return (
                        <li key={i} className={`euna-tools__item ${r ? (r.ok ? 'is-ok' : 'is-fail') : ''}`}>
                            {!r ? (
                                <Loader2 size={14} className="euna-spin" />
                            ) : r.blocked ? (
                                <Ban size={14} />
                            ) : r.ok ? (
                                <Check size={14} />
                            ) : (
                                <X size={14} />
                            )}
                            <span>{describeCommand(c)}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default function EunaPilot() {
    const pilot = usePilotRun();
    const { open, setOpen, messages, status, statusText, consent, input, setInput, send, approveConsent, declineConsent, abort, clearThread, suggestions, busy } = pilot;
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, statusText, consent, open]);

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div className="euna-root" data-euna-ignore>
            {open && (
                <section className="euna-panel" aria-label="EUNA Pilot">
                    <header className="euna-panel__head">
                        <span className="euna-panel__avatar"><OwlMark /></span>
                        <div className="euna-panel__titles">
                            <strong>EUNA Pilot</strong>
                            <span>your dashboard copilot</span>
                        </div>
                        <button className="euna-iconbtn" title="New chat" onClick={clearThread} disabled={busy}>
                            <Sparkles size={15} />
                        </button>
                        <button className="euna-iconbtn" title="Close" onClick={() => setOpen(false)}>
                            <X size={16} />
                        </button>
                    </header>

                    <div className="euna-panel__body euna-scrollbar" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="euna-empty">
                                <p className="euna-empty__hi">Hi, I'm EUNA ~</p>
                                <p className="euna-empty__sub">
                                    I can show you around your dashboard, answer questions about your
                                    classes, and operate pages for you — with your OK. I never write
                                    lesson content; that's the AI Studio's job.
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
                                        <span className="euna-msg__avatar"><OwlMark size={15} /></span>
                                        <span className={`euna-msg__text ${m.streaming ? 'is-streaming' : ''}`}>{m.text}</span>
                                    </div>
                                );
                            }
                            if (m.kind === 'tools') return <ToolCard key={m.id} msg={m} />;
                            if (m.kind === 'notice') {
                                return (
                                    <div key={m.id} className="euna-notice">
                                        <TriangleAlert size={14} />
                                        <span>{m.text}</span>
                                    </div>
                                );
                            }
                            return null;
                        })}

                        {statusText && (
                            <div className="euna-strip">
                                <span className="euna-strip__dot" />
                                {statusText}
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
                                    I'll narrate every step. Destructive confirmations stay yours to press.
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
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKey}
                            placeholder={busy ? 'EUNA is driving…' : 'Ask me to show, tell, or do…'}
                            disabled={busy}
                            rows={1}
                        />
                        {busy ? (
                            <button className="euna-send euna-send--stop" title="Stop" onClick={abort}>
                                <Square size={14} />
                            </button>
                        ) : (
                            <button className="euna-send" title="Send" onClick={() => send()} disabled={!input.trim()}>
                                <Sparkles size={15} />
                            </button>
                        )}
                    </footer>
                </section>
            )}

            <button
                className={`euna-fab ${open ? 'is-open' : ''}`}
                title="Ask EUNA"
                aria-label="Ask EUNA"
                onClick={() => setOpen(!open)}
            >
                <OwlMark size={24} />
            </button>
        </div>
    );
}
