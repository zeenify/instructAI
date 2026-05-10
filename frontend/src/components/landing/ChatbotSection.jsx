import { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import Character3D from './Character3D';

const SUGGESTED_QUESTIONS = [
  "How do I create a course?",
  "Can students execute code in the browser?",
  "What's the AI tutor like?",
  "How does curriculum generation work?",
];

const isLowEndDevice = () => {
  if (typeof window === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  return cores < 4 || memory < 4;
};

// Separate component for Character3D so it never re-renders
const CharacterContainer = memo(function CharacterContainer() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="character-container"
      style={{
        position: 'relative',
        height: '500px',
        borderRadius: '20px',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(26, 26, 58, 0.8) 0%, rgba(15, 15, 42, 0.8) 100%)',
        border: '1px solid rgba(167, 139, 250, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Character3D
        modelUrl="/models/euna.vrm"
        animate="idle"
        scale={1.5}
      />
    </motion.div>
  );
});

export default function ChatbotSection() {
  const [messages, setMessages] = useState([
    {
      type: 'bot',
      text: "Hey there! I'm Euna. Got questions about InstructAI? I'm here to help. 🎓",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const [isInView, setIsInView] = useState(true);
  const [show3D, setShow3D] = useState(true); // Force 3D model always

  // Intersection observer for animation trigger - unload 3D when scrolled away
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
      observer.disconnect();
    };
  }, []);

  // Auto-scroll chatbox ONLY when new messages overflow, not page
  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          const messageContainer = messagesEndRef.current.parentElement;
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      }, 0);
    }
  }, [messages]);

  const sendMessage = async (text = inputValue) => {
    if (!text.trim()) return;

    const userMessage = { type: 'user', text: text.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiUrl}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-8),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessages((prev) => [
          ...prev,
          { type: 'bot', text: data.response },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { type: 'bot', text: "Oops, something went wrong. Try again? 😅" },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { type: 'bot', text: "Can't reach me right now. Connection issue, sorry! 🔌" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQuestion = (question) => {
    sendMessage(question);
  };

  return (
    <section
      id="chat"
      ref={containerRef}
      className="chatbot-section"
      style={{
        background: 'linear-gradient(135deg, rgba(26, 26, 58, 0.5) 0%, rgba(15, 15, 42, 0.5) 100%)',
        padding: '80px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          background: 'radial-gradient(circle, rgba(167,139,250,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      <div className="chatbot-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="chatbot-header"
          style={{ textAlign: 'center', marginBottom: '60px' }}
        >
          <p style={{
            fontSize: '12px',
            fontWeight: '600',
            color: 'rgba(255,255,255,0.6)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>Get Answers</p>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: '800',
            color: '#f8fafc',
            marginBottom: '12px',
            background: 'linear-gradient(135deg, #a78bfa 0%, #e879f9 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Meet Euna, Your AI Assistant</h2>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255,255,255,0.7)',
            maxWidth: '500px',
            margin: '0 auto',
          }}>
            Got questions? Chat with Euna about how InstructAI works, and get instant answers.
          </p>
        </motion.div>

        <div
          className="chatbot-main"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '40px',
            alignItems: 'start',
          }}
        >
          {/* Left: Euna 3D Model - isolated from chat state */}
          <CharacterContainer />

          {/* Right: Chat Interface */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="chat-section"
          >
            {/* Chat Window */}
            <div
              style={{
                background: 'rgba(26, 26, 58, 0.6)',
                borderRadius: '16px',
                border: '1px solid rgba(167, 139, 250, 0.2)',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                marginBottom: '20px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '350px',
                backdropFilter: 'blur(10px)',
              }}
            >
              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <AnimatePresence>
                  {messages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        display: 'flex',
                        justifyContent:
                          msg.type === 'user' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          maxWidth: '85%',
                          padding: '12px 16px',
                          borderRadius: '12px',
                          background:
                            msg.type === 'user'
                              ? 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)'
                              : 'rgba(167, 139, 250, 0.15)',
                          color:
                            msg.type === 'user'
                              ? '#ffffff'
                              : '#e0d5ff',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          wordBreak: 'break-word',
                          border: msg.type === 'user' ? 'none' : '1px solid rgba(167, 139, 250, 0.2)',
                        }}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}

                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        display: 'flex',
                        gap: '4px',
                        padding: '12px 16px',
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [-6, 0, -6] }}
                          transition={{
                            duration: 0.6,
                            delay: i * 0.1,
                            repeat: Infinity,
                          }}
                          style={{
                            width: '6px',
                            height: '6px',
                            background: '#a78bfa',
                            borderRadius: '50%',
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid rgba(167, 139, 250, 0.2)',
                  display: 'flex',
                  gap: '8px',
                  background: 'rgba(15, 15, 42, 0.6)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <input
                  type="text"
                  placeholder="Ask me anything..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      sendMessage();
                    }
                  }}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: '13px',
                    outline: 'none',
                    color: '#e0d5ff',
                    opacity: isLoading ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isLoading || !inputValue.trim()}
                  style={{
                    background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                    border: 'none',
                    color: 'white',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    cursor: isLoading || !inputValue.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isLoading || !inputValue.trim() ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

            {/* Suggested Questions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.6)',
                  marginBottom: '8px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                SUGGESTED QUESTIONS
              </p>

              {SUGGESTED_QUESTIONS.map((question, idx) => (
                <motion.button
                  key={idx}
                  onClick={() => handleSuggestedQuestion(question)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading}
                  style={{
                    background: 'rgba(167, 139, 250, 0.1)',
                    color: '#e0d5ff',
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.3s ease',
                    opacity: isLoading ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontWeight: '500' }}>{question}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .chatbot-main {
            grid-template-columns: 1fr !important;
          }
          .character-container {
            height: 300px !important;
          }
        }
      `}</style>
    </section>
  );
}
