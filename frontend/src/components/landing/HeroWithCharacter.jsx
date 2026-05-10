import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Character3D from './Character3D';

// Check if device is low-power (mobile, iPad, low GPU)
const isLowEndDevice = () => {
  if (typeof window === 'undefined') return false;
  const gpu = navigator.gpu;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;
  return cores < 4 || memory < 4;
};

export default function HeroWithCharacter() {
  const [mounted, setMounted] = useState(false);
  const [characterPhase, setCharacterPhase] = useState('wait');
  const [showCharacter, setShowCharacter] = useState(!isLowEndDevice());
  const [use3D, setUse3D] = useState(!isLowEndDevice());
  const heroRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  useEffect(() => {
    if (!mounted || !use3D) return;

    // Character appears walking after hero text finishes animating (~2s)
    const walkTimer = setTimeout(() => setCharacterPhase('walk'), 2000);

    // Character exits running after ~6s
    const exitTimer = setTimeout(() => setCharacterPhase('exit'), 6000);

    // Character disappears after running animation completes
    const hideTimer = setTimeout(() => setShowCharacter(false), 7500);

    return () => {
      clearTimeout(walkTimer);
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [mounted, use3D]);

  return (
    <section className="hero-section" ref={heroRef}>
      <div className="hero-ambient-glow" />

      {/* Ethereal background */}
      <div className="canvas-container">
        <svg
          className="ethereal-svg"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.3,
          }}
        >
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      </div>

      {/* Character Animation Container */}
      {showCharacter && use3D && (
        <motion.div
          className="character-entrance-container"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '100%',
            pointerEvents: 'none',
            overflow: 'hidden',
            willChange: 'transform',
          }}
          animate={
            characterPhase === 'walk'
              ? {
                  x: 0,
                  transition: {
                    duration: 4,
                    ease: 'easeInOut',
                  },
                }
              : characterPhase === 'exit'
              ? {
                  x: '150%',
                  transition: {
                    duration: 1.5,
                    ease: 'easeOut',
                  },
                }
              : {
                  x: '-100%',
                }
          }
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '-30%',
              width: '400px',
              height: '600px',
              transform: 'translateY(-50%)',
            }}
          >
            <Character3D
              modelUrl="/models/euna.vrm"
              animate={characterPhase === 'walk' ? 'walk' : characterPhase === 'exit' ? 'run' : 'idle'}
              scale={1.8}
            />
          </div>
        </motion.div>
      )}

      {/* Static Character Fallback for Low-End Devices */}
      {showCharacter && !use3D && (
        <motion.div
          style={{
            position: 'absolute',
            top: '50%',
            left: '-20%',
            width: '300px',
            height: '500px',
            transform: 'translateY(-50%)',
            background: 'linear-gradient(135deg, rgba(167,139,250,0.1) 0%, rgba(232,121,249,0.05) 100%)',
            borderRadius: '20px',
            border: '2px solid rgba(167,139,250,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            opacity: 0.3,
          }}
          animate={
            characterPhase === 'walk'
              ? { x: '400%' }
              : characterPhase === 'exit'
              ? { x: '800%' }
              : { x: 0 }
          }
          transition={{ duration: characterPhase === 'exit' ? 1.5 : 4 }}
        >
          ✨
        </motion.div>
      )}

      {/* Hero Content */}
      <div className="hero-layout">
        <div className="hero-content">
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={mounted ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <span className="badge-dot" />
            <span className="badge-text">Next-Generation Education Platform</span>
          </motion.div>

          <motion.h1
            className="hero-title"
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Intelligent Learning,<br />
            <span className="text-gradient">Engineered</span> by AI
          </motion.h1>

          <motion.p
            className="hero-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            An AI-Powered Learning Management System — featuring a zero-setup browser IDE,
            curriculum-grounded AI lesson generation, and real-time mastery analytics.
          </motion.p>

          <motion.div
            className="hero-buttons"
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <a href="/login" className="btn-primary">
              Start Building <span>→</span>
            </a>

            <a href="/register/student" className="btn-student">
              Become a Student
            </a>

            <a href="#how-it-works" className="btn-secondary">
              How it Works
            </a>
          </motion.div>
        </div>
      </div>

      <div className="hero-bottom-fade" />
    </section>
  );
}
