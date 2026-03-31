import { useEffect, useRef, useState } from "react";
import "./LandingPage.css"; 

// ─── Ethereal Constellation Background (Hero) ─────────────────────────────────
function EtherealCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    let width, height;
    let particles = [];
    let pulses =[];
    let animationFrameId;

    const CONFIG = {
      particleCount: 120,
      maxDistance: 160,
      pulseSpeed: 0.04,
      pulseSpawnRate: 0.08,
      baseColor: "rgba(167, 139, 250, ",
      pulseColor: "#e879f9",
    };

    class Particle {
      constructor() {
        this.x = (Math.random() * 0.8 + 0.2) * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 1.5 + 0.5;
        this.neighbors =[];
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < width * 0.1 || this.x > width * 1.1) this.vx *= -1;
        if (this.y < -50 || this.y > height + 50) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
        ctx.fill();
      }
    }

    class Pulse {
      constructor(startParticle, endParticle) {
        this.start = startParticle;
        this.end = endParticle;
        this.progress = 0;
        this.completed = false;
      }
      update() {
        this.progress += CONFIG.pulseSpeed;
        if (this.progress >= 1) {
          this.completed = true;
          if (Math.random() < 0.7 && this.end.neighbors.length > 0) {
            const nextNode = this.end.neighbors[Math.floor(Math.random() * this.end.neighbors.length)];
            if (nextNode !== this.start) pulses.push(new Pulse(this.end, nextNode));
          }
        }
      }
      draw() {
        if (this.completed) return;
        const x = this.start.x + (this.end.x - this.start.x) * this.progress;
        const y = this.start.y + (this.end.y - this.start.y) * this.progress;
        const tailProgress = Math.max(0, this.progress - 0.2);
        const tailX = this.start.x + (this.end.x - this.start.x) * tailProgress;
        const tailY = this.start.y + (this.end.y - this.start.y) * tailProgress;

        const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
        gradient.addColorStop(0, "rgba(232, 121, 249, 0)");
        gradient.addColorStop(1, CONFIG.pulseColor);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.shadowBlur = 12;
        ctx.shadowColor = CONFIG.pulseColor;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    function init() {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      CONFIG.particleCount = width < 768 ? 50 : 120;
      particles = [];
      pulses =[];
      for (let i = 0; i < CONFIG.particleCount; i++) particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => { p.update(); p.neighbors =[]; });

      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONFIG.maxDistance) {
            particles[i].neighbors.push(particles[j]);
            particles[j].neighbors.push(particles[i]);
            const opacity = (1 - dist / CONFIG.maxDistance) * 0.4;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = CONFIG.baseColor + opacity + ")";
            ctx.stroke();
          }
        }
        particles[i].draw();
      }

      if (Math.random() < CONFIG.pulseSpawnRate) {
        const startNode = particles[Math.floor(Math.random() * particles.length)];
        if (startNode.neighbors.length > 0) {
          const endNode = startNode.neighbors[Math.floor(Math.random() * startNode.neighbors.length)];
          pulses.push(new Pulse(startNode, endNode));
        }
      }

      pulses = pulses.filter(p => !p.completed);
      pulses.forEach(p => { p.update(); p.draw(); });
      animationFrameId = requestAnimationFrame(animate);
    }

    const ro = new ResizeObserver(() => init());
    ro.observe(canvas);
    init();
    animate();

    return () => { cancelAnimationFrame(animationFrameId); ro.disconnect(); };
  },[]);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />;
}

// ─── Cinematic Reveal Component ───────────────────────────────────────────────
function Reveal({ children, delay = 0, className = "", style = {} }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  },[]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(40px) scale(0.98)",
        filter: visible ? "blur(0px)" : "blur(12px)",
        transition: `opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, filter 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Spotlight Card (For Features) ────────────────────────────────────────────
function SpotlightCard({ children, className = "" }) {
  const divRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    divRef.current.style.setProperty("--mouse-x", `${x}px`);
    divRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div 
      ref={divRef} 
      onMouseMove={handleMouseMove} 
      className={`spotlight-card ${className}`}
    >
      <div className="spotlight-card-content">{children}</div>
    </div>
  );
}

// ─── Magnetic Button (For CTA) ────────────────────────────────────────────────
function MagneticButton({ children, href }) {
  const btnRef = useRef(null);
  const textRef = useRef(null);

  const handleMouseMove = (e) => {
    const rect = btnRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    btnRef.current.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    textRef.current.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px)`;
  };

  const handleMouseLeave = () => {
    btnRef.current.style.transform = `translate(0px, 0px)`;
    textRef.current.style.transform = `translate(0px, 0px)`;
  };

  return (
    <a
      href={href}
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="magnetic-btn"
    >
      <span ref={textRef} className="magnetic-btn-text">{children}</span>
    </a>
  );
}


function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""} ${isMobileMenuOpen ? "mobile-open" : ""}`}>
      <div className="nav-logo">
        <div className="logo-icon">I</div>
        <span className="logo-text">InstructAI</span>
      </div>

      {/* Mobile Toggle */}
      <button className="mobile-nav-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
        <span className="hamburger-bar"></span>
        <span className="hamburger-bar"></span>
      </button>

      <div className={`nav-links ${isMobileMenuOpen ? "active" : ""}`}>
        {["Features", "How it Works", "Docs"].map(l => (
          <a key={l} href={`#${l.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => setIsMobileMenuOpen(false)}>{l}</a>
        ))}
      </div>

      <div className={`nav-auth ${isMobileMenuOpen ? "active" : ""}`}>
        <a href="/login" className="student-link">Student Portal</a>
        <a href="/login" className="login-btn">Teacher Log In</a>
        <a href="/register/teacher" className="register-btn">Start Teaching</a>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  return (
    <section className="hero-section">
      <div className="hero-ambient-glow" />
      <div className="canvas-container">
        <EtherealCanvas />
      </div>

      <div className="hero-layout">
        <div className="hero-content">
          <div className={`hero-badge ${mounted ? "visible" : ""}`}>
            <span className="badge-dot" />
            <span className="badge-text">Next-Generation Education Platform</span>
          </div>

          <h1 className={`hero-title ${mounted ? "visible" : ""}`}>
            Intelligent Learning,<br />
            <span className="text-gradient">Engineered</span> by AI
          </h1>

          <p className={`hero-subtitle ${mounted ? "visible" : ""}`}>
            An AI-Powered Learning Management System — featuring a zero-setup browser IDE, 
            curriculum-grounded AI lesson generation, and real-time mastery analytics.
          </p>

          <div className={`hero-buttons ${mounted ? "visible" : ""}`}>
            <a href="/login" className="btn-primary">
              Start Building <span>→</span>
            </a>
            
            <a href="/register/student" className="btn-student">
              Become a Student
            </a>
            
            <a href="#how-it-works" className="btn-secondary">
               How it Works
            </a>
          </div>
        </div>
      </div>
      <div className="hero-bottom-fade" />
    </section>
  );
}


// ─── Features (Bento Grid) ────────────────────────────────────────────────────
function Features() {
  return (
    <section id="features" className="features-section">
      <div className="features-container">
        <Reveal className="features-header">
          <p className="section-label">Platform Capabilities</p>
          <h2 className="section-title">Built for modern educators.</h2>
          <p className="section-subtitle">
            Purpose-built tools for ICT instruction, wrapping powerful AI models in a beautiful, seamless interface.
          </p>
        </Reveal>

        <div className="bento-grid">
          <Reveal delay={0.1} className="bento-large">
            <SpotlightCard className="feature-card">
              <div className="feature-content-large">
                <div className="feature-text">
                  <div className="feature-icon" style={{ color: '#c084fc', boxShadow: '0 0 20px rgba(192,132,252,0.2)' }}>&lt;/&gt;</div>
                  <h3>Zero-Setup Browser IDE</h3>
                  <p>Students write, compile, and execute Java instantly in the browser. No downloads, no PATH variables, no configuration required.</p>
                </div>
                <div className="mock-editor">
                  <div className="mock-header">
                    <span className="dot red"></span><span className="dot yellow"></span><span className="dot green"></span>
                    <span className="file-name">Main.java</span>
                  </div>
                  <pre className="mock-code">
                    <code>
<span style={{color: '#c084fc'}}>public class</span> Main {'{\n'}
  <span style={{color: '#c084fc'}}>public static void</span> main(String[] args) {'{\n'}
    System.out.println(<span style={{color: '#6ee7b7'}}>"Hello, InstructAI!"</span>);
  {'}\n}'}
                    </code>
                  </pre>
                </div>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.2}>
            <SpotlightCard className="feature-card">
              <div className="feature-icon" style={{ color: '#6ee7b7', boxShadow: '0 0 20px rgba(110,231,183,0.2)' }}>⚡</div>
              <h3>AI Course Generator</h3>
              <p>Upload a DepEd Daily Lesson Log and watch the AI generate complete course modules strictly grounded in your curriculum.</p>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.3}>
            <SpotlightCard className="feature-card">
              <div className="feature-icon" style={{ color: '#818cf8', boxShadow: '0 0 20px rgba(129,140,248,0.2)' }}>◈</div>
              <h3>Real-Time Analytics</h3>
              <p>Track topic mastery per student and see class-wide performance trends all in one live dashboard.</p>
            </SpotlightCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ───────────────────────────────
const steps =[
  { num: "01", title: "Upload Curriculum", desc: "Feed your DepEd DLL to the platform. The AI parses objectives, context, and requirements instantly." },
  { num: "02", title: "Generate & Review", desc: "Review the auto-generated interactive modules, coding challenges, and assessment rubrics." },
  { num: "03", title: "Deploy & Monitor", desc: "Publish to your students. Watch real-time analytics surface as they write code and complete lessons." },
];

function HowItWorks() {
  const containerRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      const totalScroll = rect.height - windowHeight;
      let progress = (windowHeight / 2 - rect.top) / totalScroll;
      progress = Math.max(0, Math.min(1, progress));
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  },[]);

  return (
    <section id="how-it-works" ref={containerRef} className="workflow-section">
      <div className="workflow-container">
        
        <div className="sticky-sidebar">
          <Reveal>
            <h2 className="section-title text-left">The Flow.</h2>
            <p className="section-subtitle text-left">From lesson plan to live classroom in seconds.</p>
          </Reveal>

          <div className="thread-container">
            <div className="thread-track" />
            <div className="thread-fill" style={{ height: `${scrollProgress * 100}%` }} />
            <div className="thread-glow-dot" style={{ top: `${scrollProgress * 100}%` }} />
          </div>
        </div>

        <div className="scrolling-steps">
          {steps.map((s, i) => (
            <div key={s.num} className="step-card">
              <div className="step-number">{s.num}</div>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-desc">{s.desc}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

// ─── CTA ───────────────────────────────────────────
function CTA() {
  return (
    <section className="cta-section">
      <div className="vortex-container">
        <div className="vortex-ring ring-1"></div>
        <div className="vortex-ring ring-2"></div>
        <div className="vortex-ring ring-3"></div>
      </div>

      <div className="cta-content">
        <Reveal>
          <h2 className="cta-title">
            Ready to upgrade<br />your classroom?
          </h2>
          <p className="cta-subtitle">
            Join educators running the most intelligent, friction-free programming classes available today.
          </p>
          <MagneticButton href="/login">
            Join InstructAI <span style={{ fontSize: 20, marginLeft: 8 }}>→</span>
          </MagneticButton>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="footer-section">
      <div className="footer-logo">
        <div className="logo-icon">I</div>
        <span>InstructAI</span>
      </div>
      <p className="footer-copy">© 2026 InstructAI Systems. All rights reserved.</p>
      <div className="footer-links">
        {["Features", "Documentation", "Terms"].map(l => (
          <a key={l} href="#">{l}</a>
        ))}
      </div>
    </footer>
  );
}

export default function LandingPage() {
  useEffect(() => {
    const glow = document.getElementById("global-mouse-glow");
    const updateGlow = (e) => {
      if (glow) {
        glow.style.left = `${e.clientX}px`;
        glow.style.top = `${e.clientY}px`;
        glow.style.opacity = "1";
      }
    };
    window.addEventListener("mousemove", updateGlow);
    return () => window.removeEventListener("mousemove", updateGlow);
  }, []);

  return (
    <div className="landing-wrapper">
      <div id="global-mouse-glow" className="mouse-glow" />
      <div className="noise-overlay" />
      
      <Navbar />
      
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
      </main>

      <Footer />

    </div>
  );
}