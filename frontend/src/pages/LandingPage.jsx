import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Menu,
  ArrowUpRight,
  BookOpen,
  Brain,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  ListChecks,
  PenLine,
  Presentation,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
  Volume2,
} from 'lucide-react';
import EunaChatSection from '../components/landing/EunaChatSection.jsx';
import LandingScene from '../components/landing3d/LandingScene.jsx';
import './LandingPage.css';
import doodlePapersImg from '../assets/landing/doodle-papers.png';
import doodleTerminalImg from '../assets/landing/doodle-terminal.png';
import markerUnderlineImg from '../assets/landing/marker-underline.png';
import coffeeStainImg from '../assets/landing/coffee-stain.png';
import sparklesImg from '../assets/landing/sparkles.png';
import cognifyImg from '../assets/landing/cognify.png';

const ROLE_KEY = 'instructai-landing-role';

function readStoredRole() {
  try {
    const v = window.localStorage.getItem(ROLE_KEY);
    return v === 'teacher' || v === 'student' ? v : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Hand-drawn SVG props
// ─────────────────────────────────────────────────────────────

function InkUnderline({ className = '' }) {
  return (
    <motion.img
      src={markerUnderlineImg}
      alt=""
      aria-hidden="true"
      className={`ink-underline ${className}`}
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.3 }}
    />
  );
}

function DoodlePapers() {
  return (
    <motion.img
      src={doodlePapersImg}
      alt=""
      aria-hidden="true"
      className="card-doodle"
      initial={{ opacity: 0, y: 8, rotate: -5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: 0.45, duration: 0.5 }}
    />
  );
}

function DoodleTerminal() {
  return (
    <motion.img
      src={doodleTerminalImg}
      alt=""
      aria-hidden="true"
      className="card-doodle"
      initial={{ opacity: 0, y: 8, rotate: 4 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ delay: 0.45, duration: 0.5 }}
    />
  );
}

function SealStamp({ label }) {
  return (
    <motion.div
      className="seal-stamp"
      initial={{ scale: 0, rotate: -30 }}
      animate={{ scale: 1, rotate: -12 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.35 }}
    >
      <Sparkles size={13} strokeWidth={2.6} />
      <span>{label}</span>
    </motion.div>
  );
}

function Tape({ className = '' }) {
  return <span className={`tape ${className}`} aria-hidden="true" />;
}

// ─────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────

function Nav({ role, onPick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  return (
    <header className="pik-nav">
      <div className="pik-nav-inner">
        <a className="pik-logo" href="#top" aria-label="InstructAI home">
          <span className="pik-logo-mark">I<span className="pik-logo-dot">.</span></span>
          <span className="pik-logo-word">InstructAI</span>
        </a>

        <nav className="pik-nav-links" aria-label="Page sections">
          <a href="#track">Features</a>
          <a href="#cognify">Cognify app</a>
          <a href="#euna">Ask Euna</a>
          <a href="#how">How it works</a>
        </nav>

        <div className="pik-nav-cta">
          <button
            className={`pik-chip ${role === 'teacher' ? 'active' : ''}`}
            onClick={() => onPick('teacher', true)}
            type="button"
          >
            <Presentation size={13} strokeWidth={2.6} /> For teachers
          </button>
          <button
            className={`pik-chip ${role === 'student' ? 'active' : ''}`}
            onClick={() => onPick('student', true)}
            type="button"
          >
            <GraduationCap size={13} strokeWidth={2.6} /> For students
          </button>
          <span className="pik-nav-divider" aria-hidden="true" />
          <a className="pik-login" href="/login">Log in</a>
          <a className="pik-getstarted" href={role === 'student' ? '/register/student' : '/register/teacher'}>
            Get started
          </a>
        </div>
        <button
          type="button"
          className="pik-burger"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Menu size={20} strokeWidth={2.5} />
        </button>
      </div>

      {menuOpen && (
        <nav className="pik-mobile-menu" aria-label="Mobile">
          <a href="#track" onClick={close}>Features</a>
          <a href="#cognify" onClick={close}>Cognify app</a>
          <a href="#euna" onClick={close}>Ask Euna</a>
          <a href="#how" onClick={close}>How it works</a>
          <button type="button" onClick={() => { onPick('teacher'); close(); }}>For teachers</button>
          <button type="button" onClick={() => { onPick('student'); close(); }}>For students</button>
          <a href="/login" onClick={close}>Log in</a>
          <a href={role === 'student' ? '/register/student' : '/register/teacher'} onClick={close}>Get started</a>
        </nav>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero choice cards (DOM layer of journey scene 0)
// ─────────────────────────────────────────────────────────────

function ChoiceCard({ kind, role, onPick }) {
  const isTeacher = kind === 'teacher';
  const chosen = role === kind;
  return (
    <motion.button
      type="button"
      className={`choice-card ${isTeacher ? 'is-teacher' : 'is-student'} ${chosen ? 'chosen' : ''}`}
      onClick={() => onPick(kind, true)}
      initial={{ opacity: 0, y: 34, rotate: isTeacher ? -8 : 7 }}
      animate={{ opacity: 1, y: 0, rotate: isTeacher ? -4.5 : 4 }}
      whileHover={{ rotate: isTeacher ? -1 : 1, y: -8, scale: 1.015, transition: { duration: 0.16, ease: 'easeOut' } }}
      whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
      transition={{ type: 'spring', stiffness: 160, damping: 17, delay: isTeacher ? 0.28 : 0.4 }}
      aria-pressed={chosen}
    >
      <Tape className="tape-tl" />
      <Tape className="tape-br" />
      {chosen && <SealStamp label="YOUR TRACK" />}
      <span className="choice-kicker">{isTeacher ? 'for educators' : 'for students'}</span>
      <span className="choice-title">
        I am here
        <br />
        to <em>{isTeacher ? 'teach' : 'learn'}</em>
      </span>
      {isTeacher ? <DoodlePapers /> : <DoodleTerminal />}
      <span className="choice-sub">
        {isTeacher ? (
          <>Upload a curriculum — the AI drafts the whole course. You polish, publish, and run the room.</>
        ) : (
          <>Read lessons, code in the browser, battle live quizzes, and ask a tutor that read your lessons.</>
        )}
      </span>
      <span className="choice-cta">
        {isTeacher ? 'Open the teacher track' : 'Open the student track'}
        <ArrowRight size={15} strokeWidth={2.8} />
      </span>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// The 3D scroll journey (5 scenes on one sticky canvas)
// ─────────────────────────────────────────────────────────────

function Journey({ role, onPick }) {
  const containerRef = useRef(null);

  // Lenis smooth scrolling — the glue that makes scroll feel choreographed
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let lenis;
    let rafId;
    let cancelled = false;
    (async () => {
      const Lenis = (await import('lenis')).default;
      if (cancelled) return;
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
      window.__lenis = lenis;
      const raf = (time) => {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      lenis?.destroy();
    };
  }, []);

  return (
    <div className="journey" ref={containerRef} id="top">
      <LandingScene containerRef={containerRef} />

      {/* Scene 0 — hero */}
      <section className="jsec jsec-hero">
        <div className="jsec-inner jsec-center">
          <motion.p
            className="pik-kicker center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            InstructAI <span className="kicker-rule" /> an AI-powered LMS, made for Penaranda Senior High School
          </motion.p>

          <h1 className="pik-headline">
            <motion.span
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.08 }}
            >
              Your classroom,
            </motion.span>
            <span className="headline-line2">
              <motion.span
                initial={{ opacity: 0, y: 26 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.2 }}
              >
                <em>supercharged</em> by AI
              </motion.span>
              <InkUnderline />
              <motion.img
                src={sparklesImg}
                alt=""
                aria-hidden="true"
                className="headline-sparkles"
                initial={{ opacity: 0, scale: 0.4, rotate: -24 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.95 }}
              />
            </span>
          </h1>

          <motion.p
            className="pik-sub"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.34 }}
          >
            Upload a curriculum and watch AI assemble the course. Students code in the
            browser — with a tutor that actually read the lessons.
          </motion.p>
        </div>

        <div className="choice-row">
          <ChoiceCard kind="teacher" role={role} onPick={onPick} />
          <div className="choice-or" aria-hidden="true">or</div>
          <ChoiceCard kind="student" role={role} onPick={onPick} />
        </div>
      </section>

      {/* Scene 1 — letters */}
      <section className="jsec jsec-letters">
        <div className="jsec-inner jsec-right">
          <motion.p
            className="pik-kicker"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.5 }}
          >
            one product, two very different desks
          </motion.p>
          <motion.h2
            className="jsec-headline"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            Teachers get a <em>co-teacher.</em><br />
            Students get a <em>tutor &amp; arcade.</em>
          </motion.h2>
          <motion.p
            className="jsec-body"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.16 }}
          >
            The page splits from here — pick a card and everything below
            rewrites itself for your side of the classroom.
          </motion.p>
        </div>
      </section>

      {/* Scene 2 — magic book */}
      <section className="jsec jsec-book">
        <div className="jsec-inner">
          <motion.p
            className="pik-kicker"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.5 }}
          >
            the teacher's desk
          </motion.p>
          <motion.h2
            className="jsec-headline"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            An AI that writes the course,
            <br /><em>not just the buzzwords</em>
          </motion.h2>
          <motion.p
            className="jsec-body"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.16 }}
          >
            Upload your curriculum file. InstructAI drafts it in three passes — outline,
            content, polish — into modules, lessons and quizzes you can edit line by line
            before anything reaches your class.
          </motion.p>
        </div>
      </section>

      {/* Scene 3 — arena */}
      <section className="jsec jsec-arena">
        <div className="jsec-inner jsec-right">
          <motion.p
            className="pik-kicker"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.5 }}
          >
            friday, last period
          </motion.p>
          <motion.h2
            className="jsec-headline"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            The whole room becomes a <em>game show.</em>
          </motion.h2>
          <motion.p
            className="jsec-body"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.16 }}
          >
            Teachers launch the quiz live and control the pace — question by question,
            reveal on demand. Students race on the leaderboard while the similarity
            scan keeps every score honest.
          </motion.p>
        </div>
      </section>

      {/* Scene 4 — graduation finale */}
      <section className="jsec jsec-grad">
        <div className="jsec-inner jsec-center">
          <motion.p
            className="pik-kicker center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.5 }}
          >
            the graduation
          </motion.p>
          <motion.h2
            className="jsec-headline"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.08 }}
          >
            Ready to <em>start?</em>
          </motion.h2>
          <motion.p
            className="jsec-body"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.16 }}
          >
            Set up your first class in minutes — or join the one your teacher made.
          </motion.p>
          <motion.div
            className="jsec-cta"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.45 }}
            transition={{ duration: 0.6, delay: 0.24 }}
          >
            <a className="btn-ink" href={role === 'student' ? '/register/student' : '/register/teacher'}>
              {role === 'student' ? 'Join your class' : 'Start teaching free'}
              <ArrowUpRight size={16} strokeWidth={2.8} />
            </a>
            <a className="btn-ghost" href="/login">I have an account — log in</a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Visual props for feature spreads
// ─────────────────────────────────────────────────────────────

function PipelineVisual() {
  return (
    <div className="prop prop-pipeline">
      <Tape className="tape-tl" />
      <div className="pipe-steps">
        <div className="pipe-step">
          <span className="pipe-num">1</span>
          <FileUp size={17} strokeWidth={2.4} />
          <span>Upload<br />curriculum</span>
        </div>
        <div className="pipe-arrow">→</div>
        <div className="pipe-step">
          <span className="pipe-num">2</span>
          <Brain size={17} strokeWidth={2.4} />
          <span>AI drafts<br />outline → content</span>
        </div>
        <div className="pipe-arrow">→</div>
        <div className="pipe-step">
          <span className="pipe-num">3</span>
          <PenLine size={17} strokeWidth={2.4} />
          <span>You polish<br />&amp; publish</span>
        </div>
      </div>
      <div className="pipe-progress">
        <motion.span
          className="pipe-progress-fill"
          initial={{ width: '4%' }}
          whileInView={{ width: '88%' }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.4 }}
        />
      </div>
      <p className="pipe-log">curriculum.pdf → 6 modules · 18 lessons · 9 quizzes — drafted in 84s</p>
    </div>
  );
}

function ExamVisual() {
  return (
    <div className="prop prop-exam">
      <Tape className="tape-tl" />
      <Tape className="tape-br" />
      <div className="exam-paper">
        <p className="exam-title">Quiz 3 — Functions <span className="exam-pts">20 pts</span></p>
        <pre className="exam-code"><span className="c-kw">def</span> <span className="c-fn">add</span>(a, b):{'\n'}{'    '}<span className="c-kw">return</span> a + b</pre>
        <div className="exam-case">
          <span className="case-io">add(2, 3) → <b>5</b></span>
          <svg viewBox="0 0 24 24" className="case-check" aria-hidden="true"><path d="M4 13 l5 5 L20 6" stroke="var(--pik-verm)" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="exam-case">
          <span className="case-io">add(-1, 1) → <b>0</b></span>
          <svg viewBox="0 0 24 24" className="case-check" aria-hidden="true"><path d="M4 13 l5 5 L20 6" stroke="var(--pik-verm)" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <p className="exam-note">every submission is run against your test cases — graded while you sip coffee</p>
      </div>
    </div>
  );
}

function GradeVisual() {
  return (
    <div className="prop prop-grade">
      <Tape className="tape-tr" />
      <div className="grade-row head"><span>Student</span><span>Activity 4</span><span>Flag</span></div>
      <div className="grade-row"><span>Mia S.</span><span className="grade-score">94</span><span className="grade-flag ok">clear</span></div>
      <div className="grade-row"><span>Jorge L.</span><span className="grade-score">88</span><span className="grade-flag ok">clear</span></div>
      <div className="grade-row warn"><span>Kai R.</span><span className="grade-score">91</span><span className="grade-flag">92% similar</span></div>
      <div className="grade-actions">
        <span className="grade-bulk">Bulk-grade remaining →</span>
        <span className="grade-book">gradebook synced</span>
      </div>
    </div>
  );
}

function AnalyticsVisual() {
  const bars = [82, 64, 28, 91, 45, 73];
  return (
    <div className="prop prop-analytics">
      <Tape className="tape-tl" />
      <div className="ana-card">
        <p className="ana-title">Lesson engagement — Module 3</p>
        <div className="ana-bars">
          {bars.map((h, i) => (
            <motion.span
              key={i}
              className="ana-bar"
              style={{ '--h': `${h}%`, background: h < 40 ? 'var(--pik-verm)' : 'var(--pik-ink)' }}
              initial={{ height: '6%' }}
              whileInView={{ height: 'var(--h)' }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 + i * 0.08, ease: 'easeOut' }}
            />
          ))}
        </div>
        <p className="ana-note">lesson 3 was barely opened before the quiz — worth a re-teach</p>
      </div>
    </div>
  );
}

function IdeVisual() {
  return (
    <div className="prop prop-ide">
      <Tape className="tape-tr" />
      <div className="ide-window">
        <div className="ide-bar">
          <span className="ide-dot" /><span className="ide-dot" /><span className="ide-dot" />
          <span className="ide-tab">Main.java</span>
        </div>
        <pre className="ide-code"><span className="c-kw">public class</span> <span className="c-fn">Main</span> {'{\n'}{'  '}<span className="c-kw">static void</span> <span className="c-fn">main</span>(String[] args) {'{\n'}{'    '}System.out.println(<span className="c-str">"Hello, Penaranda!"</span>);{'\n'}{'  '}{'}'}{'\n'}{'}'}</pre>
        <div className="ide-terminal">
          <span className="ide-prompt">$ java Main</span>
          <span className="ide-out">Hello, Penaranda!</span>
        </div>
      </div>
      <div className="ide-langs">
        {['Java', 'Python', 'JavaScript', 'C++', 'HTML'].map((l) => (
          <span className="lang-stamp" key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function LessonVisual() {
  return (
    <div className="prop prop-lesson">
      <Tape className="tape-tl" />
      <div className="lesson-card">
        <p className="lesson-chip">MODULE 2 · LESSON 4</p>
        <p className="lesson-title">Traversing a Linked List</p>
        <p className="lesson-line">
          Start at the <code>head</code>, follow each <code>next</code> pointer, and
          stop when you hit <code>null</code>…
        </p>
        <div className="lesson-progress">
          <motion.span
            className="lesson-progress-fill"
            initial={{ width: '10%' }}
            whileInView={{ width: '72%' }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, delay: 0.4, ease: 'easeOut' }}
          />
        </div>
        <div className="lesson-foot">
          <span>lesson 4 of 6 · 72% done</span>
          <span className="lesson-done">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13 l5 5 L20 6" stroke="currentColor" strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            mark as done
          </span>
        </div>
      </div>
    </div>
  );
}

function TutorVisual() {
  return (
    <div className="prop prop-tutor">
      <Tape className="tape-tl" />
      <div className="tutor-chat">
        <p className="tutor-q"><b>You:</b> How do I fix this loop? It crashes.</p>
        <p className="tutor-a">
          <b>AI Tutor:</b> Look at line 3 — your condition is <code>i &lt;= arr.length</code>,
          so the last step steps out of bounds. Use <code>&lt;</code>. Want me to show a traced run?
        </p>
        <div className="tutor-stamps">
          <span className="tutor-stamp ink">answers from <em>your</em> lessons</span>
          <span className="tutor-stamp">quiz mode: hints, never the answer</span>
        </div>
      </div>
    </div>
  );
}

function ReviewerVisual() {
  const bars = [10, 18, 8, 22, 14, 26, 12, 20, 9, 24, 16, 11, 21, 13, 25, 10];
  return (
    <div className="prop prop-reviewer">
      <Tape className="tape-br" />
      <div className="rev-card">
        <p className="rev-title">Auto-reviewer · Arrays &amp; Loops</p>
        <p className="rev-line"><span className="rev-bullet">①</span> An array has fixed size; index from <b>0</b> to <b>length − 1</b>.</p>
        <p className="rev-line"><span className="rev-bullet">②</span> Off-by-one means your loop bound is wrong — see IDE tip.</p>
        <div className="rev-tts">
          <Volume2 size={16} strokeWidth={2.4} />
          <span className="rev-wave" aria-hidden="true">
            {bars.map((w, i) => (
              <motion.i
                key={i}
                style={{ '--w': `${w}px` }}
                animate={{ scaleY: [0.5, 1, 0.6] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.07, ease: 'easeInOut' }}
              />
            ))}
          </span>
          <span className="rev-say">read it to me</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Persona-tailored editorial spreads
// ─────────────────────────────────────────────────────────────

const SPREADS = {
  teacher: [
    {
      num: '01',
      icon: Brain,
      title: 'An AI that writes the course,',
      titleEm: 'not just the buzzwords',
      body: 'Upload your curriculum file. InstructAI drafts it in three passes — outline, content, polish — into modules, lessons and quizzes you can edit line by line before anything reaches your class.',
      visual: <PipelineVisual />,
    },
    {
      num: '02',
      icon: ListChecks,
      title: 'Quizzes graded by',
      titleEm: 'real test cases',
      body: 'Attach test cases once. Every submission is compiled, run, and checked against them — objective scores, zero nights of manual checking.',
      visual: <ExamVisual />,
    },
    {
      num: '03',
      icon: ClipboardCheck,
      title: 'Grading day,',
      titleEm: 'without the all-nighter',
      body: 'Bulk-grade the whole class, keep a live gradebook, and let the similarity scan quietly flag copy-paste work before it becomes a rumor.',
      visual: <GradeVisual />,
    },
    {
      num: '04',
      icon: ScanSearch,
      title: 'See what stuck,',
      titleEm: 'and what needs a re-teach',
      body: 'Content engagement shows which lessons your class actually opened; results analysis shows which questions they missed. No guesswork — just the next topic to fix.',
      visual: <AnalyticsVisual />,
    },
  ],
  student: [
    {
      num: '01',
      icon: BookOpen,
      title: 'Lessons that read like',
      titleEm: 'someone made them for you',
      body: 'Your teacher’s course, laid out clean — progress saved as you go, one tap to mark a lesson done, and everything waits exactly where you left it.',
      visual: <LessonVisual />,
    },
    {
      num: '02',
      icon: Terminal,
      title: 'A real compiler',
      titleEm: 'in your browser tab',
      body: 'No installs, no setup night. Write and run Java, Python, JavaScript, C++ or HTML right here — challenges are checked automatically against your teacher’s test cases.',
      visual: <IdeVisual />,
    },
    {
      num: '03',
      icon: Brain,
      title: 'A tutor that',
      titleEm: 'read the lesson',
      body: 'It answers from your actual course material, gives hints in quizzes instead of answers, and politely refuses anything that is not schoolwork. A tutor with rules.',
      visual: <TutorVisual />,
    },
    {
      num: '04',
      icon: Volume2,
      title: 'Reviewers you can',
      titleEm: 'just listen to',
      body: 'One tap turns any lesson into a condensed AI reviewer — and it reads itself aloud, so exam week can happen anywhere.',
      visual: <ReviewerVisual />,
    },
  ],
};

function Spread({ data, flip }) {
  const Icon = data.icon;
  return (
    <motion.article
      className={`spread ${flip ? 'flip' : ''}`}
      initial={{ opacity: 0, y: 44 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.65, ease: 'easeOut' }}
    >
      <div className="spread-num" aria-hidden="true">{data.num}</div>
      <div className="spread-copy">
        <p className="spread-kicker">
          <Icon size={15} strokeWidth={2.5} /> chapter {data.num}
        </p>
        <h3 className="spread-title">
          {data.title} <em>{data.titleEm}</em>
        </h3>
        <p className="spread-body">{data.body}</p>
      </div>
      <div className="spread-visual">{data.visual}</div>
    </motion.article>
  );
}

function Track({ role }) {
  const isTeacher = role === 'teacher';
  return (
    <section className="pik-track" id="track">
      <AnimatePresence mode="wait">
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="track-header">
            <img src={coffeeStainImg} alt="" aria-hidden="true" className="coffee-stain" />
            <p className="pik-kicker">{isTeacher ? 'the teacher’s desk' : 'the student’s desk'}</p>
            <h2 className="track-headline">
              {isTeacher ? (
                <>It does the <em>boring half</em> of teaching.</>
              ) : (
                <>Read, code, compete — <em>then actually get it.</em></>
              )}
            </h2>
          </div>
          <div className="spreads">
            {SPREADS[role].map((s, i) => (
              <Spread key={`${role}-${s.num}`} data={s} flip={i % 2 === 1} />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Cognify — the mobile companion
// ─────────────────────────────────────────────────────────────

function CognifySection() {
  return (
    <section className="pik-cognify" id="cognify">
      <div className="cognify-inner">
        <motion.div
          className="cognify-copy"
          initial={{ opacity: 0, y: 34 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <p className="pik-kicker">
            <img src={cognifyImg} alt="" className="cognify-mini-logo" /> study on the go
          </p>
          <h2 className="cognify-headline">
            Meet <em>Cognify</em> — the review app that lives in your pocket.
          </h2>
          <p className="cognify-body">
            InstructAI’s Android companion turns your lessons into spaced-repetition
            flashcards and schedules each review for the day you’re about to forget —
            so exam week stops being cram week.
          </p>
          <ul className="cognify-points">
            <li><Brain size={15} strokeWidth={2.5} /> flashcards pulled straight from your course</li>
            <li><Volume2 size={15} strokeWidth={2.5} /> reads cards aloud with on-device voices — works offline</li>
            <li><Sparkles size={15} strokeWidth={2.5} /> streaks and study stats that only count real reviews</li>
          </ul>
          <p className="cognify-note">free on Android · signs in with your InstructAI account</p>
        </motion.div>

        <motion.div
          className="phone-wrap"
          initial={{ opacity: 0, y: 40, rotate: 6 }}
          whileInView={{ opacity: 1, y: 0, rotate: 3 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        >
          <img src={cognifyImg} alt="Cognify app logo" className="phone-logo-badge" />
          <div className="phone">
            <div className="phone-screen">
              <div className="phone-status">
                <span className="phone-app-logo"><img src={cognifyImg} alt="" /></span>
                <span className="phone-greeting">Good evening, Mia</span>
                <span className="phone-streak">🔥 6</span>
              </div>
              <div className="phone-due">
                <span className="phone-due-num">12</span>
                <span className="phone-due-label">cards due today</span>
              </div>
              <div className="phone-card">
                <p className="phone-q">What does <b>spaced repetition</b> do to forgetting?</p>
                <p className="phone-tap">tap to flip</p>
              </div>
              <div className="phone-nav">
                <span className="on">Home</span>
                <span>Review</span>
                <span>Stats</span>
              </div>
            </div>
          </div>
          <div className="phone-caption">actual study loop, one thumb</div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// How it works + footer
// ─────────────────────────────────────────────────────────────

function HowItWorks({ role }) {
  const isTeacher = role === 'teacher';
  const steps = isTeacher
    ? [
        { n: '1', t: 'Post your curriculum', d: 'Any lesson plan or module file you already have.' },
        { n: '2', t: 'Let the AI draft it', d: 'Outline, content, formatting — then you edit anything.' },
        { n: '3', t: 'Publish & run the room', d: 'Live quizzes, grading, analytics. You just teach.' },
      ]
    : [
        { n: '1', t: 'Join with a class code', d: 'One code from your teacher and the course appears.' },
        { n: '2', t: 'Read, code, compete', d: 'Lessons, the browser IDE, and live quiz Fridays.' },
        { n: '3', t: 'Watch yourself improve', d: 'Completed lessons, quiz scores and returned activities — all in one place.' },
      ];
  return (
    <section className="pik-how" id="how">
      <p className="pik-kicker center">{isTeacher ? 'the teacher path' : 'the student path'}</p>
      <h2 className="how-headline">
        {isTeacher ? <>Three steps to <em>your</em> co-teacher.</> : <>Three steps to <em>your</em> unfair advantage.</>}
      </h2>
      <div className="how-rail">
        {steps.map((s, i) => (
          <motion.div
            className="how-step"
            key={s.n}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: i * 0.14 }}
          >
            <span className="how-num">{s.n}</span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
            {i < steps.length - 1 && <span className="how-arrow" aria-hidden="true">→</span>}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Footer({ onPick }) {
  return (
    <footer className="pik-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="pik-logo-mark">I<span className="pik-logo-dot">.</span></span>
          <p className="footer-colophon">
            InstructAI — an AI-powered learning management system, set in Fraunces and
            JetBrains Mono. Built as a capstone for <b>Penaranda Senior High School</b>.
          </p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Product</h4>
            <a href="#track">Features</a>
            <a href="#cognify">Cognify app</a>
            <a href="#how">How it works</a>
          </div>
          <div>
            <h4>Educators</h4>
            <a href="/register/teacher">Create an account</a>
            <a href="/login">Log in</a>
            <button type="button" onClick={() => onPick('teacher', true)}>See the teacher side</button>
          </div>
          <div>
            <h4>Students</h4>
            <a href="/register/student">Join with a code</a>
            <a href="/login">Student log in</a>
            <button type="button" onClick={() => onPick('student', true)}>See the student side</button>
          </div>
        </div>
      </div>
      <p className="footer-line">© 2026 InstructAI · made with chalk, coffee and test cases</p>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [role, setRole] = useState(() => readStoredRole());

  const pick = (next, scroll = false) => {
    setRole(next);
    try {
      window.localStorage.setItem(ROLE_KEY, next);
    } catch {
      /* private mode — fine */
    }
    if (scroll) {
      requestAnimationFrame(() => {
        document.getElementById('track')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  return (
    <div className="pik" data-role={role ?? 'none'}>
      <Nav role={role} onPick={pick} />
      <main>
        <Journey role={role} onPick={pick} />
        {role && <Track role={role} />}
        <CognifySection />
        <EunaChatSection />
        <HowItWorks role={role} />
        <Footer onPick={pick} />
      </main>
    </div>
  );
}
