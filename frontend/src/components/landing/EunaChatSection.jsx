import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Send, Volume2, VolumeX } from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
import './EunaChatSection.css';

const SUGGESTED_QUESTIONS = [
  'What can I do here?',
  'How does the AI course generator work?',
  'Can students run code in the browser?',
  'What is Cognify?',
];

const isLowEndDevice = () => {
  if (typeof window === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  return cores < 4;
};

function Tape({ className = '' }) {
  return <span className={`tape ${className}`} aria-hidden="true" />;
}

const roleGreeting = (role) =>
  role === 'teacher'
    ? "Hey teach! I'm Euna — ask me anything about the teacher side: AI course generation, live quizzes, grading, the works."
    : role === 'student'
      ? "Hey! I'm Euna — ask me about your classes, the browser IDE, the AI tutor, or Cognify. I know everything school-related."
      : "Hey there! I'm Euna. Got questions about InstructAI? Pick your side up top and ask away!";

/* ── 3D EUNA — vanilla three.js, adapted from euna3d/viewer/public/main.js ── */
const EunaCanvas = memo(function EunaCanvas({ speakerOn, onSpeakingChange }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const speakerRef = useRef(speakerOn);
  speakerRef.current = speakerOn;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || apiRef.current) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // portrait framing straight from the working euna3d viewer
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    camera.position.set(0, 0.74, 1.35);
    camera.fov = 30;
    camera.lookAt(0, 0.71, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xfff4e8, 2.0);
    key.position.set(0.7, 1.3, 0.9);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfd8ff, 0.7);
    rim.position.set(-1.0, 0.8, -0.6);
    scene.add(rim);

    // 4-step toon ramp + outline, same recipe as the viewer
    const ramp = new Uint8Array([100, 160, 215, 255]);
    const gradientMap = new THREE.DataTexture(ramp, 4, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;
    const outline = new OutlineEffect(renderer, { defaultThickness: 0.0035, defaultColor: [0.07, 0.05, 0.04] });

    let face = null, faceMat = null, baseTex = null, lipsTex = null, blinkTex = null;
    const VISEME_TEX = {};
    const VISEME_GEO = { ai: 1.0, ee: 0.55, oh: 0.9, oo: 0.7 };
    let hair = null, bones = {}, qRest = {}, modelRoot = null;

    // organic idle bounce preset from the viewer ("neuro")
    const BOUNCE = { organic: true, y: 0.004, x: 0.005, roll: 0.018, nod: 0.8, yaw: 1.2 };

    const setMorph = (name, v) => {
      if (!face) return;
      const i = face.morphTargetDictionary[name];
      if (i !== undefined) face.morphTargetInfluences[i] = v;
    };

    new GLTFLoader().load('/euna/euna_chibi.glb', (gltf) => {
      gltf.scene.traverse((o) => {
        if (o.isMesh) {
          const old = o.material;
          o.material = new THREE.MeshToonMaterial({
            map: old.map || null,
            gradientMap,
            side: o.name === 'euna_hair' ? THREE.DoubleSide : THREE.FrontSide,
          });
        }
        if (o.isBone) {
          bones[o.name] = o;
          qRest[o.name] = o.quaternion.clone();
        }
      });
      scene.add(gltf.scene);
      modelRoot = gltf.scene;
      face = gltf.scene.getObjectByName('tripo_part_0') ||
             gltf.scene.children.find((o) => o.isMesh && o.morphTargetDictionary) || null;
      hair = gltf.scene.getObjectByName('euna_hair') || null;
      if (face) {
        faceMat = face.material;
        baseTex = face.material.map;
      }
      const tl = new THREE.TextureLoader();
      for (const [name, file] of [['ai', 'tex_talk.jpg'], ['oh', 'tex_oh.jpg'], ['oo', 'tex_oo.jpg'], ['ee', 'tex_ee.jpg']]) {
        const t = tl.load('/euna/' + file);
        t.flipY = false;
        t.colorSpace = THREE.SRGBColorSpace;
        VISEME_TEX[name] = t;
      }
      lipsTex = tl.load('/euna/tex_lips.jpg');
      lipsTex.flipY = false;
      lipsTex.colorSpace = THREE.SRGBColorSpace;
      blinkTex = tl.load('/euna/tex_blink.jpg');
      blinkTex.flipY = false;
      blinkTex.colorSpace = THREE.SRGBColorSpace;
      if (faceMat) faceMat.map = lipsTex;
      if (hair) hair.material.map = lipsTex;
      resize();
    }, undefined, () => {} /* load errors surface via the loading flag timeout */);

    // ---------- head/pose helpers ----------
    function setBone(name, pitchDeg, yawDeg) {
      const b = bones[name];
      if (!b) return;
      const e = new THREE.Euler(
        THREE.MathUtils.degToRad(pitchDeg),
        THREE.MathUtils.degToRad(yawDeg),
        0,
        'XYZ'
      );
      b.quaternion.copy(qRest[name]).multiply(new THREE.Quaternion().setFromEuler(e));
    }

    // ---------- state ----------
    let mouseX = 0, mouseY = 0, lastMouse = 0;
    let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0;
    let nextGlance = 2, glanceYaw = 0, glancePitch = 0;
    let nextBlink = performance.now() + 1500, blinkStart = -1, blinkDur = 300, doubleBlink = false;
    let smileV = 0, smileOn = true;
    let mouthV = 0, geoV = 1.0;
    let speakUntil = 0, nextSyl = 0, speakOpen = 0.6, speakShape = 'ai';

    function audioViseme() {
      if (!analyser || !speakerRef.current) return [0, 'ai'];
      analyser.getByteFrequencyData(freqData);
      let sum = 0, low = 0, high = 0;
      for (let i = 2; i < 90; i++) sum += freqData[i];
      for (let i = 3; i < 9; i++) low += freqData[i];
      for (let i = 10; i < 40; i++) high += freqData[i];
      const amp = sum / 88 / 255;
      const ratio = low / 6 / (high / 30 + 4);
      // calibration from the viewer, tuned against EUNA V4's voice
      const CAL_LO = 0.3, CAL_HI = 0.58, CAL_PW = 0.6;
      const open = Math.pow(Math.min(Math.max((amp - CAL_LO) / (CAL_HI - CAL_LO), 0), 1), CAL_PW);
      const shape = ratio > 1.25 ? (open > 0.55 ? 'oh' : 'oo') : open > 0.55 ? 'ai' : 'ee';
      return [open, shape];
    }

    // ---------- audio pipeline (created on first speaker interaction) ----------
    let analyser = null, freqData = null, audioEl = null, audioCtx = null;
    function setupAudio() {
      if (analyser) return;
      audioEl = new Audio();
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaElementSource(audioEl);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.65;
      src.connect(analyser);
      analyser.connect(audioCtx.destination);
      freqData = new Uint8Array(analyser.frequencyBinCount);
    }

    // public controller used by the chat logic
    const api = {
      speak: (ms = 4000) => {
        speakUntil = performance.now() + ms;
        nextSyl = 0;
      },
      setSmile: (v) => { smileOn = !!v; },
      loadAudio: async (blob) => {
        setupAudio();
        await audioCtx.resume();
        audioEl.src = URL.createObjectURL(blob);
        await audioEl.play();
        return new Promise((resolve) => { audioEl.onended = resolve; });
      },
      stopAudio: () => { if (audioEl) { audioEl.pause(); audioEl.src = ''; } },
    };
    apiRef.current = api;

    // ---------- resize ----------
    function resize() {
      const w = host.clientWidth || 300;
      const h = host.clientHeight || 380;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ---------- pointer head-follow: only inside the portrait, gentle clamps ----------
    let pointerInside = false;
    const onMove = (e) => {
      const b = host.getBoundingClientRect();
      mouseX = ((e.clientX - b.left) / b.width) * 2 - 1;
      mouseY = -((e.clientY - b.top) / b.height) * 2 - 1;
      mouseX = Math.max(-1, Math.min(1, mouseX));
      mouseY = Math.max(-1, Math.min(1, mouseY));
      lastMouse = performance.now();
      pointerInside = true;
    };
    const onLeave = () => { pointerInside = false; lastMouse = 0; };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);

    // ---------- render loop ----------
    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;

    function tickBody() {
      const now = performance.now();
      const t = clock.getElapsedTime();

      // head target: mouse follow, or idle glances when the pointer is away
      if (now - lastMouse > 5000 && now > nextGlance) {
        nextGlance = now + 2500 + Math.random() * 4000;
        if (Math.random() < 0.35) { glanceYaw = 0; glancePitch = 0; }
        else { glanceYaw = (Math.random() - 0.5) * 0.6; glancePitch = (Math.random() - 0.5) * 0.25; }
      }
      const active = pointerInside && now - lastMouse <= 5000;
      targetYaw = active ? Math.max(-0.4, Math.min(0.4, mouseX * 0.38)) : glanceYaw;
      targetPitch = active ? Math.max(-0.2, Math.min(0.2, -mouseY * 0.22)) : glancePitch;
      yaw += (targetYaw - yaw) * 0.08;
      pitch += (targetPitch - pitch) * 0.08;

      // organic idle bounce
      if (modelRoot) {
        const yB = Math.sin(2 * Math.PI * 0.85 * t) * 0.7 + Math.sin(2 * Math.PI * 0.47 * t + 1.3) * 0.3;
        const xB = Math.sin(2 * Math.PI * 0.31 * t + 0.6) * 0.7 + Math.sin(2 * Math.PI * 0.71 * t + 2.1) * 0.3;
        modelRoot.position.y = BOUNCE.y * yB;
        modelRoot.position.x = BOUNCE.x * xB;
        modelRoot.rotation.z = BOUNCE.roll * Math.sin(2 * Math.PI * 0.31 * t + 1.7);
        setBone('head', THREE.MathUtils.radToDeg(pitch) + BOUNCE.nod * Math.sin(2 * Math.PI * 0.85 * t - 0.8),
                THREE.MathUtils.radToDeg(yaw) + BOUNCE.yaw * Math.sin(2 * Math.PI * 0.31 * t - 0.1));
        setBone('neck', THREE.MathUtils.radToDeg(pitch) * 0.35, THREE.MathUtils.radToDeg(yaw) * 0.35);
        setBone('chest', Math.sin(t * 1.1) * 1.2, 0);
        setBone('spine', Math.sin(t * 0.8) * 0.8, 0);
      }

      // blink
      let blinkV = 0;
      if (blinkStart < 0 && now > nextBlink) {
        blinkStart = now;
        doubleBlink = Math.random() < 0.18;
      }
      if (blinkStart >= 0) {
        const p = (now - blinkStart) / blinkDur;
        if (p >= 1) {
          blinkStart = doubleBlink ? now + 60 : -1;
          if (!doubleBlink) nextBlink = now + 2400 + Math.random() * 3200;
          doubleBlink = false;
        } else {
          blinkV = Math.sin(Math.min(p, 1) * Math.PI);
        }
      }
      setMorph('blinkL', blinkV * 0.3);
      setMorph('blinkR', blinkV * 0.3);
      if (hair && hair.morphTargetDictionary) {
        const hd = hair.morphTargetDictionary;
        if (hd.blinkL !== undefined) hair.morphTargetInfluences[hd.blinkL] = blinkV * 0.3;
        if (hd.blinkR !== undefined) hair.morphTargetInfluences[hd.blinkR] = blinkV * 0.3;
      }

      // mouth viseme engine: scripted when TTS is unavailable, FFT-driven
      // when real audio is playing through the analyser
      let lvl, shape;
      if (now < speakUntil && !(analyser && speakerRef.current && audioEl && !audioEl.paused)) {
        if (now > nextSyl) {
          nextSyl = now + 80 + Math.random() * 100;
          const r = Math.random();
          if (r < 0.28) { speakOpen = 0.05; speakShape = 'ai'; }
          else {
            speakOpen = 0.5 + Math.random() * 0.5;
            const r2 = Math.random();
            speakShape = r2 < 0.35 ? 'ai' : r2 < 0.6 ? 'ee' : r2 < 0.85 ? 'oh' : 'oo';
          }
        }
        lvl = speakOpen; shape = speakShape;
      } else {
        [lvl, shape] = audioViseme();
      }
      const target = lvl;
      const rate = target > mouthV ? 0.22 : 0.13;
      mouthV += (target - mouthV) * rate;
      geoV += ((VISEME_GEO[shape] || 1) - geoV) * 0.12;
      setMorph('mouthOpen', mouthV * geoV * 0.3);

      // face map resolver: blink > talking viseme > resting lips
      if (faceMat) {
        let wantMap = lipsTex;
        if (mouthV > 0.5 && VISEME_TEX[shape]) wantMap = VISEME_TEX[shape];
        if (blinkV > 0.55) wantMap = blinkTex;
        if (faceMat.map !== wantMap) faceMat.map = wantMap;
      }

      smileV += ((smileOn ? 0.85 : 0) - smileV) * 0.1;
      setMorph('smile', smileV);

      outline.render(scene, camera);
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      tickBody();
    }
    tick();
    // rAF throttles to ~0 in hidden tabs; keep her alive (chat overlay case)
    const keepAlive = setInterval(() => { if (document.hidden && visible) tickBody(); }, 150);

    // pause rendering entirely when the section is scrolled away
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) tick();
    }, { threshold: 0.02 });
    io.observe(host);

    return () => {
      visible = false;
      cancelAnimationFrame(raf);
      clearInterval(keepAlive);
      io.disconnect();
      ro.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      apiRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="euna-canvas-host" ref={hostRef} />;
});

export default function EunaChatSection() {
  const [role, setRole] = useState(() => localStorage.getItem('instructai-landing-role'));
  const [messages, setMessages] = useState([{ type: 'bot', text: roleGreeting(localStorage.getItem('instructai-landing-role')) }]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lowEnd] = useState(isLowEndDevice);
  const [show3D, setShow3D] = useState(true);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const speakerRef = useRef(false);

  // unload the 3D canvas when the section scrolls away (perf)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setShow3D(entry.isIntersecting), { threshold: 0.02 });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // re-greet when the persona choice changes mid-session
  useEffect(() => {
    const onStorage = () => {
      const r = localStorage.getItem('instructai-landing-role');
      setRole(r);
      setMessages((prev) => {
        if (prev.length > 1) return prev; // conversation already started, don't reset
        return [{ type: 'bot', text: roleGreeting(r) }];
      });
    };
    addEventListener('storage', onStorage);
    const poll = setInterval(onStorage, 1200); // same-tab persona switches don't fire storage
    return () => { removeEventListener('storage', onStorage); clearInterval(poll); };
  }, []);

  useEffect(() => {
    if (messages.length > 1 && messagesEndRef.current) {
      setTimeout(() => {
        const c = messagesEndRef.current.parentElement;
        c.scrollTop = c.scrollHeight;
      }, 0);
    }
  }, [messages, isLoading]);

  const speakText = async (text, api) => {
    if (!speakerRef.current || !api) return;
    setIsSpeaking(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const res = await fetch(`${apiUrl}/euna/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('tts ' + res.status);
      const blob = await res.blob();
      await api.loadAudio(blob); // resolves when playback ends; FFT drives the mouth
    } catch {
      api.speak(Math.min(9000, 1800 + text.length * 55)); // TTS failed: lip-sync silently
    } finally {
      setIsSpeaking(false);
    }
  };

  const sendMessage = async (text = inputValue) => {
    if (!text.trim() || isLoading) return;
    setMessages((prev) => [...prev, { type: 'user', text: text.trim() }]);
    setInputValue('');
    setIsLoading(true);

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    try {
      const res = await fetch(`${apiUrl}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-8),
          role: localStorage.getItem('instructai-landing-role'),
        }),
      });
      const data = await res.json();
      const reply = res.ok ? data.response : 'Ugh, my brain glitched. Ask me again?';
      setMessages((prev) => [...prev, { type: 'bot', text: reply }]);
      await speakText(reply);
    } catch {
      setMessages((prev) => [...prev, { type: 'bot', text: "I can't reach my brain right now — try again in a sec!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpeaker = () => {
    setSpeakerOn((on) => {
      const next = !on;
      speakerRef.current = next;
      if (!next) setIsSpeaking(false);
      return next;
    });
  };

  const roleLabel =
    role === 'teacher' ? 'teacher mode' :
    role === 'student' ? 'student mode' : 'pick a side above!';

  return (
    <section className="euna-section" id="euna">
      <div className="euna-inner">
        <motion.div
          className="euna-header"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 0.6 }}
        >
          <p className="pik-kicker">stuck? ask euna</p>
          <h2 className="euna-headline">
            Meet <em>Euna.</em> InstructAI's chaos gremlin.
          </h2>
          <p className="euna-sub">
            She knows every feature of this platform and refuses to talk about
            anything else. Turn the speaker on — she talks back.
          </p>
        </motion.div>

        <motion.div
          className="euna-stage"
          initial={{ opacity: 0, y: 34 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-70px' }}
          transition={{ duration: 0.65, delay: 0.1 }}
        >
          {/* 3D portrait */}
          <div className="euna-portrait-card" ref={containerRef}>
            <Tape className="tape tape-tl" />
            {show3D && !lowEnd ? (
              <EunaCanvas speakerOn={speakerOn} />
            ) : (
              <div className="euna-canvas-fallback">
                <span className="font-hand">3D is napping on low-end devices</span>
              </div>
            )}
            <div className="euna-portrait-hud">
              <span className={`euna-role-chip ${role ?? 'none'}`}>{roleLabel}</span>
              <button
                type="button"
                className={`euna-speaker ${speakerOn ? 'on' : ''} ${isSpeaking ? 'speaking' : ''}`}
                onClick={toggleSpeaker}
                title={speakerOn ? 'Speaker is on — Euna will talk' : 'Turn on the speaker'}
              >
                {speakerOn ? <Volume2 size={17} strokeWidth={2.4} /> : <VolumeX size={17} strokeWidth={2.4} />}
                {speakerOn ? 'speaker on' : 'speaker off'}
              </button>
            </div>
          </div>

          {/* chatbox */}
          <div className="euna-chat-card">
            <div className="euna-chat-scroll">
              {messages.map((m, i) => (
                <div key={i} className={`euna-msg ${m.type}`}>
                  {m.type === 'bot' && <span className="euna-msg-avatar"><img src="/euna/euna_profile.png" alt="" className="euna-msg-avatar-img" /></span>}
                  <p className="euna-msg-text">{m.text}</p>
                </div>
              ))}
              {isLoading && (
                <div className="euna-msg bot">
                  <span className="euna-msg-avatar"><img src="/euna/euna_profile.png" alt="" className="euna-msg-avatar-img" /></span>
                  <p className="euna-msg-text euna-typing">thinking<span>.</span><span>.</span><span>.</span></p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="euna-suggestions">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} type="button" className="euna-suggestion" onClick={() => sendMessage(q)} disabled={isLoading}>
                  {q}
                </button>
              ))}
            </div>

            <form
              className="euna-input-row"
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            >
              <input
                type="text"
                placeholder="Ask Euna about InstructAI…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
              />
              <button type="submit" className="euna-send" disabled={isLoading || !inputValue.trim()} aria-label="Send">
                <Send size={16} strokeWidth={2.6} />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
