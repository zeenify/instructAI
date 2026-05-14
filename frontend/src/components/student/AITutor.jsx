import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api from '../../services/api';
import { toast } from 'sonner';
import './AITutor.css';

const CodeBlock = ({ node, inline, className, children, ...props }) => {
    const [copied, setCopied] = useState(false);
    const code = String(children).replace(/\n$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (inline) {
        return <code className={className} {...props}>{children}</code>;
    }

    const language = className?.replace(/language-/, '') || 'code';

    return (
        <div className="code-block-wrapper">
            <div className="code-block-header">
                <span className="code-language">{language}</span>
                <button
                    className="copy-button"
                    onClick={handleCopy}
                    title="Copy code"
                >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
            </div>
            <pre className={className} {...props}>
                <code>{code}</code>
            </pre>
        </div>
    );
};

export default function AITutor({
    classId,
    lessonId = null,
    quizId = null,
    aiEnabled = true,
    contextItem,
    lessonContent = null,
    quizContent = null
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [selectedCharacter, setSelectedCharacter] = useState('professor');
    const [characters, setCharacters] = useState([]);
    const [showCharacterMenu, setShowCharacterMenu] = useState(false);
    const scrollRef = useRef(null);

    // Load characters on mount and restore selected character from localStorage
    useEffect(() => {
        const aiServiceUrl = import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001';
        fetch(`${aiServiceUrl}/ai/characters`)
            .then(res => res.json())
            .then(data => {
                setCharacters(data.characters);
                // Restore selected character from localStorage
                const saved = localStorage.getItem('selectedAiCharacter');
                if (saved) {
                    setSelectedCharacter(saved);
                }
            })
            .catch(err => {
                console.error('Failed to load characters:', err);
                toast.error('Failed to load AI characters');
            });
    }, []);

    // Load chat history only when character or class changes (continuous across lessons)
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

    // Scroll to bottom when opening chat
    useEffect(() => {
        if (isOpen && scrollRef.current) {
            setTimeout(() => {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }, 0);
        }
    }, [isOpen]);

    // Close if AI disabled
    useEffect(() => {
        if (!aiEnabled) setIsOpen(false);
    }, [aiEnabled]);

    const loadHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await api.post('/student/ai/history', {
                class_id: classId,
                character_name: selectedCharacter,
            });

            setMessages(res.data.messages);

            // Add greeting if no history
            if (res.data.messages.length === 0) {
                const char = characters.find(c => c.name.toLowerCase().includes(selectedCharacter));
                if (char) {
                    setMessages([{
                        sender: 'ai',
                        message: char.greeting
                    }]);
                }
            }
        } catch (err) {
            console.error('Failed to load history', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading || !aiEnabled) return;

        const userMessage = input.trim();
        setInput("");
        setMessages(prev => [...prev, { sender: 'student', message: userMessage }]);
        setLoading(true);

        try {
            const res = await api.post('/student/ai/chat', {
                message: userMessage,
                class_id: classId,
                character_name: selectedCharacter,
                lesson_id: lessonId,
                quiz_id: quizId,
                lesson_content: lessonContent,
                quiz_content: quizContent,
            });

            setMessages(prev => [...prev, {
                sender: 'ai',
                message: res.data.answer
            }]);

        } catch (err) {
            console.error('AI chat error:', err);
            toast.error('AI tutor is unavailable right now');
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setLoading(false);
        }
    };

    const switchCharacter = (charKey) => {
        setSelectedCharacter(charKey);
        localStorage.setItem('selectedAiCharacter', charKey);
        setShowCharacterMenu(false);
        setMessages([]);
    };

    const currentCharacter = characters.find(c =>
        c.name.toLowerCase().includes(selectedCharacter)
    ) || characters[0];

    if (!aiEnabled) return null;

    return (
        <>
            {/* Floating Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                className="ai-fab"
                title="Open AI Tutor"
            >
                <div className="fab-glow" />
                <Bot size={28} className="relative z-10" />
                <div className="fab-badge">
                    <Sparkles size={10} />
                </div>
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
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="ai-window"
                        >
                            {/* Header */}
                            <div className="ai-header">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setShowCharacterMenu(!showCharacterMenu)}
                                        className="ai-icon-box hover:scale-110 transition-transform"
                                        title="Switch character"
                                    >
                                        <span className="text-2xl">{currentCharacter?.avatar || '🤖'}</span>
                                    </button>
                                    <div>
                                        <h3 className="ai-title">{currentCharacter?.name || 'AI Tutor'}</h3>
                                        <p className="ai-context">
                                            <span className="pulse-dot" />
                                            {contextItem?.title || 'General Assistance'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="ai-close">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Character Selector */}
                            {showCharacterMenu && (
                                <div className="character-menu">
                                    {characters.map((char, i) => {
                                        const charKey = char.name.toLowerCase().split(' ')[0];
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => switchCharacter(charKey)}
                                                className={`character-option ${selectedCharacter === charKey ? 'active' : ''}`}
                                            >
                                                <span className="text-2xl">{char.avatar}</span>
                                                <div>
                                                    <div className="font-bold">{char.name}</div>
                                                    <div className="text-xs opacity-70">
                                                        {char.personality.split('.')[0]}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Messages */}
                            <div className="ai-messages custom-scrollbar" ref={scrollRef}>
                                {loadingHistory ? (
                                    <div className="flex justify-center items-center h-full">
                                        <Loader2 className="animate-spin text-cyan-400" size={32} />
                                    </div>
                                ) : (
                                    messages.map((msg, i) => (
                                        <div key={i} className={`msg-row ${msg.sender === 'ai' ? 'ai' : 'user'}`}>
                                            <div className="msg-bubble">
                                                {msg.sender === 'ai' ? (
                                                    <div className="markdown-content">
                                                        <ReactMarkdown components={{ code: CodeBlock }}>
                                                            {msg.message}
                                                        </ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    msg.message
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {loading && (
                                    <div className="msg-row ai">
                                        <div className="msg-bubble typing-indicator">
                                            <span></span><span></span><span></span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="ai-footer">
                                <form onSubmit={handleSend} className="ai-input-wrapper">
                                    <input
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask a question..."
                                        className="ai-input"
                                        disabled={loading}
                                    />
                                    <button type="submit" className="ai-send-btn" disabled={loading}>
                                        <Send size={18} />
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
