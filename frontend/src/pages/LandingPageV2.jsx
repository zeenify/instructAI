import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Zap, Code2, BarChart3, BookOpen, Brain, MessageSquare, Sparkles } from 'lucide-react';
import ChatbotSection from '../components/landing/ChatbotSection';
import Character3D from '../components/landing/Character3D';
import './LandingPageV2.css';

// ────── NAVBAR ──────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar-v2 ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-container">
        <div className="nav-logo">
          <div className="logo-icon">I</div>
          <span>InstructAI</span>
        </div>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#chat">Get Help</a>
        </div>

        <div className="nav-cta">
          <a href="/login" className="btn-login">Login</a>
          <a href="/register/teacher" className="btn-signup">Get Started</a>
        </div>
      </div>
    </nav>
  );
}

// ────── HERO ──────
function Hero() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="hero-v2">
      <div className="hero-gradient" />

      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
      >
        <div className="hero-badge">
          <Sparkles size={16} />
          <span>AI-Powered Learning Management System</span>
        </div>

        <h1 className="hero-title">
          Intelligent Curriculum
          <br />
          <span className="gradient-text">Powered by AI</span>
        </h1>

        <p className="hero-subtitle">
          Generate complete curriculum, create interactive quizzes, and deploy an AI tutor—all in minutes.
          Students code in the browser. Teachers teach smarter.
        </p>

        <div className="hero-buttons">
          <a href="/register/teacher" className="btn-primary">
            <span>Start Teaching Free</span>
            <ArrowRight size={18} />
          </a>
          <a href="#features" className="btn-secondary">
            Explore Features
          </a>
        </div>

        <div className="hero-stats">
          <div className="stat">
            <div className="stat-number">0s</div>
            <div className="stat-label">Setup</div>
          </div>
          <div className="stat">
            <div className="stat-number">∞</div>
            <div className="stat-label">Scale</div>
          </div>
          <div className="stat">
            <div className="stat-number">4</div>
            <div className="stat-label">AI Powers</div>
          </div>
        </div>
      </motion.div>

      <div className="hero-visual">
        <div className="feature-highlight">
          <div className="highlight-badge">AI Tutor Demo</div>
          <div className="highlight-content">
            <div className="ai-message">
              <span className="ai-avatar">🤖</span>
              <p>Let's learn about loops today!</p>
            </div>
            <div className="student-message">
              <p>How do I use for loops?</p>
              <span className="student-avatar">👨‍🎓</span>
            </div>
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ────── FEATURES ──────
const FEATURES = [
  {
    icon: Zap,
    title: 'AI Curriculum Generator',
    description: 'Upload any lesson plan. AI generates complete interactive modules, exercises, and learning paths in seconds.',
    color: '#a78bfa',
    highlight: true,
  },
  {
    icon: BookOpen,
    title: 'Smart Quiz Builder',
    description: 'AI automatically creates quizzes aligned with curriculum objectives. Set difficulty, question types, and auto-grading.',
    color: '#6ee7b7',
    highlight: true,
  },
  {
    icon: Brain,
    title: 'AI Tutor',
    description: 'Students get personalized AI tutoring. Answers questions, explains concepts, and adapts to each learning pace in real-time.',
    color: '#e879f9',
    highlight: true,
  },
  {
    icon: Code2,
    title: 'Browser-Based IDE',
    description: 'Write, compile, and execute Java code instantly. No setup, no installations, no configuration.',
    color: '#6ee7b7',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Analytics',
    description: 'Track mastery per student. Identify struggling topics. See class-wide trends instantly.',
    color: '#a78bfa',
  },
  {
    icon: MessageSquare,
    title: 'Interactive Lessons',
    description: 'Rich editor with code blocks, embedded media, and interactive challenges. Students engage, not just consume.',
    color: '#e879f9',
  },
];

function Features() {
  return (
    <section id="features" className="features-v2">
      <div className="section-container">
        <motion.div
          className="section-header"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2>Everything Built In</h2>
          <p>Four powerful AI-driven tools for complete programming education</p>
        </motion.div>

        <div className="features-grid">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={i}
              className={`feature-card ${feature.highlight ? 'highlight' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ translateY: -8 }}
            >
              <div className="feature-icon" style={{ color: feature.color }}>
                <feature.icon size={32} />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              {feature.highlight && <div className="feature-badge">⭐ Core</div>}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────── HOW IT WORKS ──────
const STEPS = [
  {
    num: '01',
    title: 'Upload Lesson Plan',
    desc: 'Feed your curriculum to InstructAI. The AI understands learning objectives instantly.',
    icon: '📄',
  },
  {
    num: '02',
    title: 'AI Creates Everything',
    desc: 'Modules, quizzes, code challenges, and practice problems—all automatically generated.',
    icon: '✨',
  },
  {
    num: '03',
    title: 'Publish & Deploy',
    desc: 'One click to go live. Students join, learn, and get personalized AI tutoring.',
    icon: '🚀',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="how-it-works-v2">
      <div className="section-container">
        <motion.div
          className="section-header"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <h2>The Workflow</h2>
          <p>From lesson plan to live classroom in three elegant steps</p>
        </motion.div>

        <div className="steps-grid">
          {STEPS.map((step, i) => (
            <motion.div
              key={i}
              className="step-card"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              viewport={{ once: true }}
            >
              <div className="step-icon">{step.icon}</div>
              <div className="step-number">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
              {i < STEPS.length - 1 && <div className="step-arrow">→</div>}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────── AI TUTOR SPOTLIGHT ──────
function AiTutorSpotlight() {
  return (
    <section className="tutor-spotlight">
      <div className="section-container">
        <div className="spotlight-content">
          <motion.div
            className="spotlight-text"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2>AI Tutor for Every Student</h2>
            <p>
              Every student gets a personalized AI tutor available 24/7. Ask questions anytime.
              Get explanations tailored to your learning level. Learn at your own pace.
            </p>
            <div className="tutor-features">
              <div className="tutor-feature">
                <Brain size={20} />
                <span>Explains concepts step-by-step</span>
              </div>
              <div className="tutor-feature">
                <MessageSquare size={20} />
                <span>Answers questions in real-time</span>
              </div>
              <div className="tutor-feature">
                <Sparkles size={20} />
                <span>Adapts to learning pace</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="spotlight-visual"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="tutor-card">
              <div className="tutor-header">AI Tutor - Student Session</div>
              <div className="tutor-chat">
                <div className="chat-message bot">
                  <span>What would you like help with today? 📚</span>
                  <span className="timestamp">Just now</span>
                </div>
                <div className="chat-message user">
                  <span>How do loops work?</span>
                  <span className="timestamp">Just now</span>
                </div>
                <div className="chat-message bot">
                  <span>Great question! Let me explain...</span>
                  <span className="timestamp">Just now</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ────── CTA ──────
function FinalCTA() {
  return (
    <section className="final-cta-v2">
      <motion.div
        className="cta-content"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <h2>Ready to transform education?</h2>
        <p>Join educators building the future of learning with AI.</p>
        <a href="/register/teacher" className="btn-primary">
          <span>Get Started Free</span>
          <ArrowRight size={18} />
        </a>
      </motion.div>
    </section>
  );
}

// ────── FOOTER ──────
function Footer() {
  return (
    <footer className="footer-v2">
      <div className="section-container">
        <div className="footer-content">
          <div className="footer-col">
            <h4>InstructAI</h4>
            <p>AI-powered learning management system for the next generation of programming education.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#chat">Get Help</a>
          </div>
          <div className="footer-col">
            <h4>Educators</h4>
            <a href="/register/teacher">Get Started</a>
            <a href="/login">Sign In</a>
          </div>
          <div className="footer-col">
            <h4>Students</h4>
            <a href="/register/student">Join Class</a>
            <a href="/login">Student Portal</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 InstructAI. A capstone project for intelligent programming education.</p>
        </div>
      </div>
    </footer>
  );
}

// ────── MAIN PAGE ──────
export default function LandingPageV2() {
  return (
    <div className="landing-v2">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <AiTutorSpotlight />
        <ChatbotSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
