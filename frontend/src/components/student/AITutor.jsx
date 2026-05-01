import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, Send, Sparkles, Zap, MessageSquare, BrainCircuit } from 'lucide-react';
import './AITutor.css';

export default function AITutor({ contextItem }) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([
        { role: 'ai', content: "Hello! I'm your InstructAI Tutor. I'm tuned into this lesson and ready to help you with concepts or code hints. What's on your mind?" }
    ]);
    const scrollRef = useRef(null);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const newMsg = { role: 'user', content: input };
        setMessages([...messages, newMsg]);
        setInput("");

        // Placeholder for future AI response logic
        setTimeout(() => {
            setMessages(prev => [...prev, { 
                role: 'ai', 
                content: "I'm currently in 'Shell Mode'. Once my brain is connected to the FastAPI server, I'll be able to help you solve " + (contextItem?.title || "this task") + "!" 
            }]);
        }, 1000);
    };

    return (
        <>
            {/* --- 1. THE FLOATING BUTTON (FAB) --- */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                className="ai-fab"
            >
                <div className="fab-glow" />
                <Bot size={28} className="relative z-10" />
                <div className="fab-badge">
                    <Sparkles size={10} />
                </div>
            </motion.button>

            {/* --- 2. THE CHAT WINDOW --- */}
            <AnimatePresence>
                {isOpen && (
                    <div className="ai-overlay">
                        {/* Backdrop for mobile */}
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                                    <div className="ai-icon-box">
                                        <BrainCircuit size={20} />
                                    </div>
                                    <div>
                                        <h3 className="ai-title">AI Tutor</h3>
                                        <p className="ai-context">
                                            <span className="pulse-dot" />
                                            Context: {contextItem?.title || 'General Assistance'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="ai-close">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Messages */}
                            <div className="ai-messages custom-scrollbar" ref={scrollRef}>
                                {messages.map((msg, i) => (
                                    <div key={i} className={`msg-row ${msg.role}`}>
                                        <div className="msg-bubble">
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer Area */}
                            <div className="ai-footer">
                                {/* Quick Action Suggestions */}
                                <div className="ai-suggestions">
                                    <button className="chip">Explain Concept</button>
                                    <button className="chip">Give me a Hint</button>
                                    <button className="chip">Fix Syntax</button>
                                </div>

                                <form onSubmit={handleSend} className="ai-input-wrapper">
                                    <input 
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Ask a question..."
                                        className="ai-input"
                                    />
                                    <button type="submit" className="ai-send-btn">
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