import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Copy, Check, Users, Eraser } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api from '../../services/api';
import { toast } from 'sonner';
import './AITutor.css';

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001';

/* The tutor mark — a small ink owl on paper. Hand-drawn strokes, sage belly,
   marker-yellow beak. Replaces the old generic robot icon. */
const OwlMark = ({ size = 36 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M15.5 13.5 L10.5 5.5 L20 9.5" fill="var(--bg-card)" stroke="var(--text-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M32.5 13.5 L37.5 5.5 L28 9.5" fill="var(--bg-card)" stroke="var(--text-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M24 7.5 C33.5 7.5 39.5 15 39.5 26 C39.5 36.5 32.5 42.5 24 42.5 C15.5 42.5 8.5 36.5 8.5 26 C8.5 15 14.5 7.5 24 7.5 Z" fill="var(--bg-card)" stroke="var(--text-primary)" strokeWidth="2" strokeLinejoin="round" />
        <ellipse cx="24" cy="32" rx="9.5" ry="7.5" fill="var(--accent)" opacity="0.22" />
        <circle cx="17.5" cy="21.5" r="5.2" fill="var(--bg-card)" stroke="var(--text-primary)" strokeWidth="2" />
        <circle cx="30.5" cy="21.5" r="5.2" fill="var(--bg-card)" stroke="var(--text-primary)" strokeWidth="2" />
        <circle cx="18.4" cy="22" r="2" fill="var(--text-primary)" />
        <circle cx="29.6" cy="22" r="2" fill="var(--text-primary)" />
        <path d="M24 25 L26.8 28.6 L21.2 28.6 Z" fill="#ffd43b" stroke="var(--text-primary)" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M19 42.5 L19 45.2 M24 42.8 L24 45.5 M29 42.5 L29 45.2" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

const Avatar = ({ char, size = 40 }) => {
    if (char?.image) {
        return <img className="ai-avatar-img" src={char.image} alt={char.name} style={{ width: size, height: size }} />;
    }
    return (
        <span className="ai-avatar-mono" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
            {char?.name?.[0] || '?'}
        </span>
    );
};

const CodeBlockView = ({ language, codeText }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(codeText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-language">{language}</span>
                <button className="copy-button" onClick={handleCopy} title="Copy code">
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
            </div>
            <pre>
                <code>{codeText}</code>
            </pre>
        </div>
    );
};

// Flatten markdown AST children (strings, elements, arrays) to plain text
const nodeText = (node) => {
    if (node == null) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(nodeText).join('');
    if (node?.props?.children !== undefined) return nodeText(node.props.children);
    return '';
};

// react-markdown v10: fenced blocks arrive as pre > code; render our paper
// code panel there. Bare `code` (inline spans) passes through untouched.
const MdPre = ({ children }) => {
    const codeEl = Array.isArray(children) ? children[0] : children;
    const className = codeEl?.props?.className || '';
    const language = className.replace(/language-/, '') || 'code';
    const codeText = nodeText(codeEl?.props?.children).replace(/\n$/, '');
    return <CodeBlockView language={language} codeText={codeText} />;
};

const CHIPS = {
    normal: ['Explain simpler', 'Show me an example', 'Quiz me on this'],
    restricted: ['Explain the concept', 'Give me a hint', 'What should I review?'],
};

export default function AITutor({
    classId,
    lessonId = null,
    quizId = null,
    quizIndex = null,
    aiEnabled = true,
    contextItem
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedCharacter, setSelectedCharacter] = useState(
        () => localStorage.getItem('selectedAiCharacter') || 'kai'
    );
    const [characters, setCharacters] = useState([]);
    const [showPicker, setShowPicker] = useState(false);
    const [mode, setMode] = useState('normal');
    const [clearArmed, setClearArmed] = useState(false);
    const scrollRef = useRef(null);
    const clearTimer = useRef(null);
    const historyReqRef = useRef(0);

    // Load characters on mount and restore selection from localStorage.
    // Failure stays silent (console only): the Python AI service being down is
    // an environment condition, not something the student should be toast-spammed about.
    useEffect(() => {
        fetch(`${AI_SERVICE_URL}/ai/characters`)
            .then(res => res.json())
            .then(data => {
                setCharacters(data.characters || []);
            })
            .catch(err => {
                console.error('Failed to load characters:', err);
            });
    }, []);

    // Load chat history whenever the character or class changes (continuous across lessons)
    useEffect(() => {
        if (classId) {
            loadHistory();
        }
    }, [selectedCharacter, classId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (!aiEnabled) setIsOpen(false);
    }, [aiEnabled]);

    useEffect(() => () => clearTimeout(clearTimer.current), []);

    const currentCharacter = characters.find(c => c.key === selectedCharacter)
        || (characters.length ? characters[0] : null);

    const loadHistory = async () => {
        // Version the request so a slow response for a previously selected
        // character can't clobber the newer character's messages
        const reqId = ++historyReqRef.current;
        setLoadingHistory(true);
        try {
            const res = await api.post('/student/ai/history', {
                class_id: classId,
                character_name: selectedCharacter,
            });

            if (reqId !== historyReqRef.current) return;
            setMessages(res.data.messages);
        } catch (err) {
            console.error('Failed to load history', err);
        } finally {
            if (reqId === historyReqRef.current) {
                setLoadingHistory(false);
            }
        }
    };

    const updateLastAi = (text, done = false) => {
        setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { sender: 'ai', message: text, ...(done ? {} : { streaming: true }) };
            return copy;
        });
    };

    // The Python stream ends with this sentinel; the browser strips it.
    const STREAM_END = '<<<END_OF_TUTOR>>>';

    const sendStream = async (userMessage) => {
        // 1. Laravel runs every check and hands us the signed payload + turn
        //    token. The student's turn is already persisted by this call.
        const prep = await api.post('/student/ai/chat-prepare', {
            message: userMessage,
            class_id: classId,
            character_name: selectedCharacter,
            lesson_id: lessonId,
            quiz_id: quizId,
            question_index: quizId ? quizIndex : null,
        });

        setMode(prep.data.mode || 'normal');

        // Quiz-question guard refusal: show it directly, nothing to stream
        if (prep.data.answer) {
            updateLastAi(prep.data.answer, true);
            return prep.data.answer;
        }

        // 2. Stream the answer straight from the Python service. The payload
        //    travels as an opaque signed string — its HMAC is the ticket.
        let full = '';
        try {
            const res = await fetch(`${AI_SERVICE_URL}/ai/tutor-chat-stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload_json: prep.data.payload_json,
                    auth_sig: prep.data.auth_sig,
                    auth_ts: prep.data.auth_ts,
                }),
            });
            if (!res.ok || !res.body) throw new Error('stream failed');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                full += decoder.decode(value, { stream: true });
                updateLastAi(full.replace(STREAM_END, ''));
            }
        } catch (streamErr) {
            console.warn('Tutor stream failed', streamErr);
            if (full) {
                full = full.replace(STREAM_END, '').trim();
                updateLastAi(full + '\n\n(The connection dropped mid-answer — please send that again.)', true);
            } else {
                updateLastAi('(I could not reach the tutoring service just now — please try again in a moment.)', true);
            }
        }

        const clean = full.replace(STREAM_END, '').trim();
        // Gemini occasionally returns zero content (heavily constrained
        // prompts); never dead-end the conversation on it
        updateLastAi(clean || '(I drew a blank there — mind rephrasing, or asking about a specific part of your lesson?)', true);

        // 3. Persist the AI turn (single-use token; empty answers are skipped
        //    server-side so connection-drop notices never enter history)
        try {
            await api.post('/student/ai/chat-commit', {
                turn_token: prep.data.turn_token,
                answer: clean,
            });
        } catch (commitErr) {
            console.warn('Tutor commit failed', commitErr);
        }

        return clean;
    };

    const sendFallback = async (userMessage) => {
        const res = await api.post('/student/ai/chat', {
            message: userMessage,
            class_id: classId,
            character_name: selectedCharacter,
            lesson_id: lessonId,
            quiz_id: quizId,
            question_index: quizId ? quizIndex : null,
        });
        setMode(res.data.mode || 'normal');
        updateLastAi(res.data.answer, true);
    };

    const handleSend = async (rawText) => {
        const userMessage = (typeof rawText === 'string' ? rawText : input)?.trim?.() ?? '';
        if (!userMessage || loading || !aiEnabled) return;

        // Invalidate any in-flight history load: the student's own message
        // and the streamed answer now own the thread. Clear the flag too —
        // a discarded load's stale-guard skips its own finally, and the
        // skeleton/chips gate must not stay stuck on it.
        historyReqRef.current++;
        setLoadingHistory(false);

        setInput("");
        setMessages(prev => [...prev, { sender: 'student', message: userMessage }, { sender: 'ai', message: '', streaming: true }]);
        setLoading(true);

        try {
            await sendStream(userMessage);
        } catch (streamErr) {
            console.warn('Stream failed, falling back to request/response', streamErr);
            try {
                await sendFallback(userMessage);
            } catch (err) {
                console.error('AI chat error:', err);
                toast.error('AI tutor is unavailable right now');
                // Drop the optimistic pair on total failure
                setMessages(prev => prev.slice(0, -2));
            }
        } finally {
            setLoading(false);
        }
    };

    const switchCharacter = (key) => {
        setSelectedCharacter(key);
        localStorage.setItem('selectedAiCharacter', key);
        setShowPicker(false);
        setMessages([]);
    };

    const handleClear = useCallback(() => {
        if (!clearArmed) {
            setClearArmed(true);
            clearTimer.current = setTimeout(() => setClearArmed(false), 3000);
            return;
        }
        clearTimeout(clearTimer.current);
        setClearArmed(false);
        api.post('/student/ai/clear', {
            class_id: classId,
            character_name: selectedCharacter,
        }).then(() => {
            setMessages(currentCharacter?.greeting
                ? [{ sender: 'ai', message: currentCharacter.greeting }]
                : []);
        }).catch(err => {
            console.error('Failed to clear chat', err);
            toast.error('Could not clear the chat');
        });
    }, [clearArmed, classId, selectedCharacter, currentCharacter]);

    if (!aiEnabled) return null;

    const lastMsg = messages[messages.length - 1];
    const showChips = !loading && !loadingHistory && lastMsg?.sender === 'ai' && lastMsg?.message && !lastMsg.streaming;

    // Greeting fallback while there's no history yet — computed at render so
    // a slow characters/history fetch can never leave the window blank
    const visibleMessages = messages.length === 0 && currentCharacter?.greeting
        ? [{ sender: 'ai', message: currentCharacter.greeting }]
        : messages;

    return (
        <>
            {/* Floating Button — ink owl on paper */}
            <motion.button
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setIsOpen(true)}
                className="ai-fab"
                style={quizId ? { bottom: 176 } : undefined}
                title="Open AI Tutor"
                aria-label="Open AI Tutor"
            >
                <OwlMark size={38} />
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <div className="ai-overlay">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="ai-backdrop"
                        />

                        <motion.div
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "100%", opacity: 0 }}
                            transition={{ type: "spring", damping: 26, stiffness: 300 }}
                            className="ai-window"
                        >
                            {/* Header */}
                            <div className="ai-header">
                                <div className="ai-header-id">
                                    <Avatar char={currentCharacter} size={42} />
                                    <div>
                                        <h3 className="ai-title">{currentCharacter?.name || 'AI Tutor'}</h3>
                                        <p className="ai-context">
                                            <span className="pulse-dot" />
                                            {contextItem?.title || 'General help'}
                                        </p>
                                    </div>
                                </div>
                                <div className="ai-header-actions">
                                    {characters.length > 0 && (
                                        <button
                                            onClick={() => setShowPicker(true)}
                                            className="ai-header-btn"
                                            title="Switch tutor"
                                        >
                                            <Users size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={handleClear}
                                        className={`ai-header-btn ${clearArmed ? 'armed' : ''}`}
                                        title={clearArmed ? 'Click again to clear' : 'Clear this chat'}
                                    >
                                        <Eraser size={18} />
                                    </button>
                                    <button onClick={() => setIsOpen(false)} className="ai-header-btn" title="Close">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Body: messages + character sheet */}
                            <div className="ai-body">
                                <div className="ai-messages custom-scrollbar" ref={scrollRef}>
                                    {loadingHistory && messages.length === 0 ? (
                                        <div className="ai-history-skeleton">
                                            <div className="db-skeleton" style={{ width: '70%', height: 44, borderRadius: 14 }} />
                                            <div className="db-skeleton" style={{ width: '55%', height: 44, borderRadius: 14, alignSelf: 'flex-end' }} />
                                            <div className="db-skeleton" style={{ width: '65%', height: 44, borderRadius: 14 }} />
                                        </div>
                                    ) : (
                                        visibleMessages.map((msg, i) => (
                                            <div key={i} className={`msg-row ${msg.sender === 'ai' ? 'ai' : 'user'}`}>
                                                {msg.sender === 'ai' && currentCharacter && i > 0 && (
                                                    <Avatar char={currentCharacter} size={26} />
                                                )}
                                                <div className="msg-bubble">
                                                    {msg.sender === 'ai' ? (
                                                        <>
                                                            <div className="markdown-content">
                                                                <ReactMarkdown components={{ pre: MdPre }}>
                                                                    {msg.message || ''}
                                                                </ReactMarkdown>
                                                            </div>
                                                            {msg.streaming && <span className="stream-cursor" />}
                                                            {msg.message && (
                                                                <button
                                                                    className="msg-copy"
                                                                    title="Copy message"
                                                                    onClick={(e) => {
                                                                        navigator.clipboard.writeText(msg.message);
                                                                        e.currentTarget.blur();
                                                                    }}
                                                                >
                                                                    <Copy size={13} />
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        msg.message
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    {loading && !messages.some(m => m.streaming) && (
                                        <div className="msg-row ai">
                                            <div className="msg-bubble typing-indicator">
                                                <span></span><span></span><span></span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Character picker sheet */}
                                <AnimatePresence>
                                    {showPicker && (
                                        <motion.div
                                            initial={{ y: "100%" }}
                                            animate={{ y: 0 }}
                                            exit={{ y: "100%" }}
                                            transition={{ type: "spring", damping: 28, stiffness: 320 }}
                                            className="character-sheet"
                                        >
                                            <div className="sheet-head">
                                                <div>
                                                    <h4 className="sheet-title">Choose your tutor</h4>
                                                    <p className="sheet-sub">Same class, same notes — different vibes.</p>
                                                </div>
                                                <button onClick={() => setShowPicker(false)} className="ai-header-btn" title="Back to chat">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                            <div className="sheet-scroll custom-scrollbar">
                                                {['barkada', 'guests'].map(group => {
                                                    const groupChars = characters.filter(c => (c.group || 'barkada') === group);
                                                    if (!groupChars.length) return null;
                                                    return (
                                                        <div key={group} className="sheet-group">
                                                            <div className="sheet-group-label">
                                                                {group === 'barkada' ? 'The barkada' : 'Guest stars'}
                                                            </div>
                                                            <div className="sheet-grid">
                                                                {groupChars.map(char => {
                                                                    const active = char.key === selectedCharacter
                                                                        || (!characters.some(c => c.key === selectedCharacter) && char === characters[0]);
                                                                    return (
                                                                        <button
                                                                            key={char.key}
                                                                            onClick={() => switchCharacter(char.key)}
                                                                            className={`character-card ${active ? 'active' : ''}`}
                                                                        >
                                                                            <Avatar char={char} size={52} />
                                                                            <div className="character-card-name">{char.name}</div>
                                                                            <div className="character-card-tag">{char.tagline}</div>
                                                                            {active && <span className="character-card-check" />}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Footer */}
                            <div className="ai-footer">
                                {showChips && (
                                    <div className="ai-chips">
                                        {(CHIPS[mode] || CHIPS.normal).map(chip => (
                                            <button key={chip} className="ai-chip" onClick={() => handleSend(chip)}>
                                                {chip}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="ai-input-wrapper">
                                    <input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder={`Ask ${currentCharacter?.name?.split(' ')[0] || 'your tutor'} anything...`}
                                        className="ai-input"
                                        disabled={loading}
                                    />
                                    <button type="submit" className="ai-send-btn" disabled={loading} aria-label="Send">
                                        <Send size={17} />
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
