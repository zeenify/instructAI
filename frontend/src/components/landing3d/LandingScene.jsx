// The landing journey v3 — the typography lives INSIDE the world.
// Headlines are Fraunces rendered as 3D text standing in the scene next to
// the models, so scrolling reads as one continuous place instead of a page
// with a parallax backdrop. The DOM only carries nav, small captions and
// interactive bits. Scroll = camera dolly through five stages.
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Text, useAnimations } from '@react-three/drei';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { fittedClone } from './fit.js';

const M = '/models/landing/';
const F_ROMAN = '/fonts/Fraunces-SemiBold.ttf';
const F_ITALIC = '/fonts/Fraunces-SemiBoldItalic.ttf';
const F_BLACK = '/fonts/Fraunces-Black.ttf';
const F_CHALK = '/fonts/WalterTurncoat-Regular.ttf';
const INK = '#16130e';
const VERM = '#ff4b26';
const SAGE = '#3e8e7e';
const CHALK = '#f6f1e6';

// ── easing helpers ─────────────────────────────────────────
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => v * v * (3 - 2 * v);
const lerp = (a, b, t) => a + (b - a) * t;

// ── a model with skeleton-aware fit, grounded on y=0 ─────────
function Rig({ url, size = 1.7, byHeight = false, geomOnly = false, robust = true, play = false, ...props }) {
  const gltf = useLoader(GLTFLoader, url);
  const group = useRef();
  const { actions } = useAnimations(gltf.animations, group);
  const model = useMemo(() => fittedClone(gltf.scene, size, byHeight, geomOnly, robust).wrap, [gltf, size, byHeight, geomOnly, robust]);

  useEffect(() => {
    if (!play) return;
    const list = Object.values(actions).filter(Boolean);
    list.forEach((a) => {
      a.reset();
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.play();
    });
    return () => list.forEach((a) => a?.stop());
  }, [actions, play]);

  return (
    <group ref={group} {...props}>
      <primitive object={model} />
    </group>
  );
}

// ── gentle life for props: a bob, a tilt, a slow turn. Never a
//    showcase spin — the camera transit already provides motion. ──
function Float({ amp = 0.06, speed = 1, tilt = 0, drift = 0, children }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * speed) * amp;
    if (tilt) ref.current.rotation.z = Math.sin(t * speed * 0.7) * tilt;
    if (drift) ref.current.rotation.y = Math.sin(t * drift) * 0.55;
  });
  return <group ref={ref}>{children}</group>;
}

// ── skinned models whose bind pose is COLLAPSED (scale-compensated rigs
// where the animation itself poses the parts). Strategy: play the take
// unmodified and measure its full bounds by CPU-skinning sampled poses, so
// the whole performance fits the intended stage box.
function PoseRig({ url, size = 1.5, ...props }) {
  const gltf = useLoader(GLTFLoader, url);
  const outer = useRef();
  const inner = useRef();
  const { actions, names, mixer } = useAnimations(gltf.animations, inner);
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || !names.length || !inner.current) return;
    const name = names[0];
    const action = actions[name];
    if (!action) return;
    action.play();
    const clip = action.getClip();
    const dur = clip.duration;
    const xs = [];
    const ys = [];
    const zs = [];
    const v = new THREE.Vector3();
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      mixer.setTime((i / steps) * dur);
      inner.current.updateMatrixWorld(true);
      inner.current.traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
        if (o.isSkinnedMesh && o.geometry) {
          const pos = o.geometry.attributes.position;
          const count = pos.count;
          const step = Math.max(1, Math.floor(count / 120));
          for (let j = 0; j < count; j += step) {
            v.fromBufferAttribute(pos, j);
            if (o.applyBoneTransform) o.applyBoneTransform(j, v);
            v.applyMatrix4(o.matrixWorld);
            xs.push(v.x); ys.push(v.y); zs.push(v.z);
          }
        } else if (o.isMesh) {
          const b = new THREE.Box3().setFromObject(o);
          xs.push(b.min.x, b.max.x); ys.push(b.min.y, b.max.y); zs.push(b.min.z, b.max.z);
        }
      });
    }
    const pick = (arr, q) => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
    };
    const minX = pick(xs, 0.01), maxX = pick(xs, 0.99);
    const minY = pick(ys, 0.01), maxY = pick(ys, 0.99);
    const minZ = pick(zs, 0.01), maxZ = pick(zs, 0.99);
    const w = maxX - minX, h = maxY - minY, d = maxZ - minZ;
    const maxDim = Math.max(w, h, d) || 1;
    const k = size / maxDim;
    inner.current.scale.setScalar(k);
    inner.current.position.set(
      -((minX + maxX) / 2) * k,
      -minY * k,
      -((minZ + maxZ) / 2) * k,
    );
    action.time = 0;
    fitted.current = true;
  }, [actions, names, mixer, size]);

  return (
    <group ref={outer} {...props}>
      <group ref={inner}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
}

// ── in-world typography ─────────────────────────────────────
// Each headline is 1–2 Text nodes; wraps are pre-computed from an estimated
// glyph width so mobile line breaks still stack correctly. Opacity follows
// camera distance — troika's SDF shader ignores scene fog, so this fade IS
// the fog for text (models fade via the real fog).
function useStageFade(ref, worldZ, rate = 0.13) {
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.abs(state.camera.position.z - (worldZ + 7));
    const o = clamp01(1.25 - d * rate);
    g.traverse((n) => {
      const m = n.material;
      if (m && 'opacity' in m) {
        m.transparent = o < 0.999;
        m.opacity = o;
      }
    });
  });
}

function StageText({ lines, position, stageZ, size = 0.6, gap = 0.3 }) {
  const group = useRef();
  const { size: vp, camera } = useThree();
  const aspect = vp.width / vp.height;
  // shrink the whole block on narrow screens instead of letting it overflow
  const scale = Math.min(1, Math.max(0.55, aspect / 1.55));
  const visW = 2 * 7 * Math.tan(((camera.fov || 42) * Math.PI) / 360) * aspect;
  const maxWidth = Math.min(8, (visW / scale) * 0.92);
  // narrow screens: lift the block toward the top of the frame so the hero's
  // stacked cards don't cover it
  const yBase = position[1] + (aspect < 0.9 ? 0.6 : 0);

  const layout = useMemo(() => {
    let y = 0;
    return lines.map((l) => {
      const fs = l.size || size;
      const rows = Math.max(1, Math.ceil((l.text.length * fs * 0.5) / maxWidth));
      const slot = { ...l, fs, y, rows };
      y += rows * fs * 1.16 + gap * fs;
      return slot;
    });
  }, [lines, size, gap, maxWidth]);

  useStageFade(group, stageZ + position[2]);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    // the type breathes very slightly so it feels part of the world
    g.position.y = yBase + Math.sin(state.clock.elapsedTime * 0.8 + stageZ) * 0.03;
  });

  return (
    <group ref={group} position={position} scale={scale}>
      {layout.map((l, i) => (
        <Text
          key={i}
          font={l.em ? F_ITALIC : F_ROMAN}
          fontSize={l.fs}
          color={l.em ? VERM : INK}
          anchorX="center"
          anchorY="top"
          maxWidth={maxWidth}
          textAlign="center"
          position={[0, -l.y, 0]}
        >
          {l.text}
        </Text>
      ))}
    </group>
  );
}

// ── the paper plane: the journey's transition beat ─────────
// Entirely scroll-tied — it has no animation of its own. Parked at a stage
// it waits just offscreen; the moment you scroll between stages it sweeps
// across the frame (direction alternates per stage) and parks again.
// Same scroll position = same plane pose, every time.
function WorldPlane({ containerRef, reducedMotion }) {
  const outer = useRef();
  const bank = useRef();

  useFrame((state) => {
    // same section-anchored progress the camera uses
    let f = 0;
    const el = containerRef.current;
    if (el) {
      const sections = el.querySelectorAll('.jsec');
      for (let i = 0; i < sections.length; i++) {
        const r = sections[i].getBoundingClientRect();
        if (r.top <= 0 && (i === sections.length - 1 || sections[i + 1].getBoundingClientRect().top > 0)) {
          f = i + clamp01(-r.top / Math.max(r.height, 1));
          break;
        }
      }
    }
    const k = Math.min(3, Math.floor(f));
    const frac = f - k;
    const dir = k % 2 === 0 ? 1 : -1; // alternate fly direction per stage
    const cam = state.camera;

    // crossing arc: offscreen at both ends of a stage pair, upper-middle of
    // the frame in the middle (y kept under the frustum's top edge)
    const sp = smooth(clamp01((frac - 0.06) / 0.88));
    const x = reducedMotion ? 60 : lerp(-6.5 * dir, 6.5 * dir, sp);
    const y = 1.95 + Math.sin(sp * Math.PI) * 0.3;
    const z = cam.position.z - 3.4;
    const yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2;

    outer.current.position.set(x, y, z);
    outer.current.rotation.y = yaw;
    const lift = Math.sin(sp * Math.PI);
    bank.current.rotation.z = lift * 0.28 * dir;
    bank.current.rotation.x = -lift * 0.1;
  });

  return (
    <group ref={outer}>
      <group ref={bank}>
        <Rig url={M + 'paper-plane.glb'} size={1.05} rotation={[0.1, 0, 0]} />
      </group>
    </group>
  );
}

// ── stage 1 letters: typeset Fraunces letters that SPELL something ──
// Two words stand on the paper floor: TEACH (left, vermilion) and
// LEARN (right, sage). Jittered sizes, depths and turns keep them
// hand-set rather than typeset-perfect.
function TypeStage({ stageZ }) {
  const group = useRef();
  const { size: vp } = useThree();
  const aspect = vp.width / vp.height;
  const spread = Math.min(1, Math.max(0.5, aspect / 1.55));

  const letters = useMemo(() => {
    const make = (word, x0, palette) =>
      word.split('').map((ch, i) => ({
        ch,
        x: x0 + i * 0.68,
        z: [-0.95, -0.3, -0.85, -0.25, -0.9][i % 5],
        s: [0.82, 0.68, 0.9, 0.7, 0.84][i % 5],
        c: palette[i % palette.length],
        r: [-0.24, 0.3, -0.18, 0.26, -0.3][i % 5],
      }));
    return [
      ...make('TEACH', -3.55, [VERM, INK, SAGE, INK]),
      ...make('LEARN', 0.75, [SAGE, INK, VERM, INK]),
    ];
  }, []);

  // fade faster than the headlines: the camera flies right through this row,
  // and un-faded letters clip giant fragments through the near plane
  useStageFade(group, stageZ, 0.2);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.children.forEach((g, i) => {
      // a gentle wave runs through the words — schoolroom energy, not chaos
      g.position.y = Math.abs(Math.sin(t * 1.3 - i * 0.5)) * 0.12;
    });
  });

  return (
    <group ref={group} scale={spread}>
      {letters.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]} rotation={[0, l.r, 0]}>
          <Text
            font={F_BLACK}
            fontSize={l.s}
            color={l.c}
            anchorX="center"
            anchorY="bottom"
            position={[0, 0.02, 0]}
          >
            {l.ch}
          </Text>
        </group>
      ))}
    </group>
  );
}

// ── chalk writing for the blackboards ──────────────────────
// Real chalk lines that WRITE THEMSELVES in a loop: a clip rectangle
// sweeps left to right like a hand laying down strokes, holds, erases.
function BoardWriting({ lines, width = 1.1, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const refs = useRef([]);
  const widths = useRef([]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const CYCLE = 7;
    const WRITE = 1.5;
    const STAGGER = 1.1;
    refs.current.forEach((text, i) => {
      if (!text) return;
      const w = widths.current[i] ?? 0;
      if (!w && text.textWidth) widths.current[i] = text.textWidth;
      if (!w) return;
      const start = i * STAGGER;
      const cycleT = t % CYCLE;
      let p = clamp01((cycleT - start) / WRITE);
      // hold the full line for most of the cycle, then a quick erase beat
      if (cycleT > CYCLE - 0.5) p = 1 - clamp01((cycleT - (CYCLE - 0.5)) / 0.5) * 0.65;
      p = smooth(p);
      const h = text.textHeight || 0.2;
      text.clipRect = [-0.02, -h - 0.02, w * p + 0.02, 0.02];
    });
  });

  let y = 0;
  return (
    <group position={position} rotation={rotation}>
      {lines.map((l, i) => {
        const slot = y;
        y += (l.size || 0.16) * 1.5;
        return (
          <Text
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            font={F_CHALK}
            fontSize={l.size || 0.16}
            color={CHALK}
            anchorX="left"
            anchorY="top"
            maxWidth={width}
            position={[0, -slot, 0.001]}
          >
            {l.text}
          </Text>
        );
      })}
    </group>
  );
}

// ── the world ──────────────────────────────────────────────
const STAGE_DZ = 14;

function World({ containerRef, reducedMotion, onReady }) {
  const camera = useThree((s) => s.camera);
  const light = useRef();
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const pointer = useRef({ x: 0, y: 0 });
  const book = useRef();
  const owl = useRef();
  const readySent = useRef(false);

  // One frame after everything inside Suspense has mounted, tell the page
  // to fade the journey in — this is what kills the flat-DOM flash on
  // refresh (the DOM stays invisible until the world is actually there).
  useFrame(() => {
    if (readySent.current || !onReady) return;
    readySent.current = true;
    // troika rasterizes its SDF fonts async; give it a beat
    setTimeout(onReady, 250);
  });

  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((state, dt) => {
    const el = containerRef.current;
    let p = 0;
    if (el) {
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      p = clamp01(-r.top / (total || 1));
    }
    const t = state.clock.elapsedTime;

    // stage index straight from the DOM sections — immune to any layout
    // offsets above the journey (nav, margins, whatever comes later)
    let f = 0;
    if (el) {
      const sections = el.querySelectorAll('.jsec');
      for (let i = 0; i < sections.length; i++) {
        const r = sections[i].getBoundingClientRect();
        if (r.top <= 0 && (i === sections.length - 1 || sections[i + 1].getBoundingClientRect().top > 0)) {
          f = i + clamp01(-r.top / Math.max(r.height, 1));
          break;
        }
      }
    }

    // camera travels from stage k to stage k+1 as section k scrolls through
    const k = Math.min(3, Math.floor(f));
    const frac = smooth(f - k);
    const camZ = lerp(stages[k] + 7, stages[k + 1] + 7, frac);
    // lateral sway so the stage sits opposite the text panel
    const swayA = [0, 0, 1.35, 0, 0];
    const sway = lerp(swayA[k], swayA[k + 1], frac);
    const drift = reducedMotion ? 0 : 1;
    const targetX = sway + pointer.current.x * 0.3 * drift;
    const targetY = 1.55 + pointer.current.y * 0.18 * drift + Math.sin(t * 0.4) * 0.04;
    camera.position.x = lerp(camera.position.x, targetX, 0.05);
    camera.position.y = lerp(camera.position.y, targetY, 0.05);
    camera.position.z = camZ;
    camera.lookAt(sway * 0.55, 0.95, camZ - 7);

    // key light follows the camera so every stage is lit
    if (light.current) {
      light.current.position.set(camera.position.x + 4, 7, camera.position.z + 4);
      lightTarget.position.set(camera.position.x, 0, camera.position.z - 7);
      lightTarget.updateMatrixWorld();
    }

    // the magic book hovers with a slow, deliberate bob
    if (book.current) {
      book.current.position.y = 0.55 + Math.sin(t * 0.9) * 0.09;
      book.current.rotation.z = Math.sin(t * 0.6) * 0.03;
    }

    // the owl breathes: gentle bob + attentive head-tilt sway (group transforms
    // only — safe for the scale-compensated rig)
    if (owl.current && !reducedMotion) {
      owl.current.position.y = 0.55 + Math.sin(t * 1.1) * 0.04;
      owl.current.rotation.z = Math.sin(t * 0.55) * 0.03;
      owl.current.rotation.y = Math.sin(t * 0.35) * 0.06;
    }
  });

  const stages = [0, 1, 2, 3, 4].map((i) => -i * STAGE_DZ);

  return (
    <>
      {/* the long paper path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, -27]} receiveShadow>
        <planeGeometry args={[30, 130]} />
        <meshStandardMaterial color="#ece2cd" roughness={1} />
      </mesh>
      <primitive object={lightTarget} />
      <directionalLight
        ref={light}
        castShadow
        intensity={2.1}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
      />
      <hemisphereLight intensity={0.85} groundColor="#cbb894" />
      <directionalLight position={[-6, 4, 2]} intensity={0.45} color="#e8ecff" />

      {/* ── stage 0 · hero: the wordmark in the world, owl below it ── */}
      <group position={[0, 0, stages[0]]}>
        <StageText
          position={[0, 2.98, -1.9]}
          stageZ={stages[0]}
          size={0.7}
          lines={[
            { text: 'Your classroom,' },
            { text: 'supercharged by AI', em: true },
          ]}
        />
        <Rig url={M + 'books-stack.glb'} size={1.15} position={[0, 0, 0]} rotation={[0, 0.35, 0]} />
        <group ref={owl} position={[0, 0.78, -0.3]}>
          <PoseRig url={M + 'wizard-owl.glb'} size={0.42} />
        </group>
        <Rig url={M + 'pencil.glb'} size={0.6} position={[2.2, 0.02, 0.9]} rotation={[0, -0.7, 0]} />
      </group>

      {/* ── stage 1 · two words set in type, spelling the two sides ── */}
      <group position={[0, 0, stages[1]]}>
        <StageText
          position={[0, 2.6, -0.3]}
          stageZ={stages[1]}
          size={0.55}
          lines={[
            { text: 'Built for teachers.' },
            { text: 'Built for students.', em: true },
          ]}
        />
        <TypeStage stageZ={stages[1]} />
      </group>

      {/* ── stage 2 · the magic book writes itself, pencil at the ready ── */}
      <group position={[0, 0, stages[2]]}>
        <StageText
          position={[-1.95, 2.2, -0.5]}
          stageZ={stages[2]}
          size={0.5}
          lines={[
            { text: 'AI writes the course.' },
            { text: 'You make it yours.', em: true },
          ]}
        />
        <group ref={book}>
          <Rig
            url={M + 'magic-book.glb'}
            size={1.1}
            play
            position={[1.7, 0.55, -0.15]}
            rotation={[-0.1, -0.4, 0]}
          />
        </group>
        <Float amp={0.07} speed={1.3} tilt={0.06} drift={0.35}>
          <Rig url={M + 'pencil.glb'} size={0.55} position={[0.6, 1.5, 0.55]} rotation={[0.6, -1.2, 0.5]} />
        </Float>
        <Rig url={M + 'books-stack.glb'} size={0.6} position={[1.95, 0, -0.6]} rotation={[0, -0.5, 0]} />
      </group>

      {/* ── stage 3 · blackboard classroom, trophy earned ── */}
      <group position={[0, 0, stages[3]]}>
        <StageText
          position={[0, 2.7, -0.5]}
          stageZ={stages[3]}
          size={0.6}
          lines={[
            { text: 'Quiz time feels like' },
            { text: 'game night.', em: true },
          ]}
        />
        <group position={[-2.4, 0.02, -2.2]} rotation={[0, 0.15, 0]}>
          <Rig url={M + 'blackboard.glb'} size={1.9} />
          <BoardWriting
            position={[-0.58, 1.1, 0.055]}
            rotation={[0, 0, 0.012]}
            width={1.2}
            lines={[
              { text: 'GAME NIGHT', size: 0.2 },
              { text: 'friday, last period', size: 0.115 },
            ]}
          />
        </group>
        <Float amp={0.05} speed={1.2} tilt={0.02} drift={0.3}>
          <Rig url={M + 'trophy.glb'} size={0.62} position={[1.75, 0.02, 0.4]} />
        </Float>
      </group>

      {/* ── stage 4 · graduation — the cap tossed high, forever ── */}
      <group position={[0, 0, stages[4]]}>
        <StageText
          position={[0, 2.0, -0.3]}
          stageZ={stages[4]}
          size={0.66}
          lines={[
            { text: 'Ready to' },
            { text: 'start?', em: true },
          ]}
        />
        <Float amp={0.12} speed={0.9} tilt={0.08} drift={0.45}>
          <Rig url={M + 'grad-cap.glb'} size={1.0} position={[2.05, 1.55, -0.6]} />
        </Float>
        <Rig url={M + 'books-stack.glb'} size={0.85} position={[1.8, 0, 0.2]} rotation={[0, -0.3, 0]} />
        <group position={[-2.35, 0.02, -0.9]} rotation={[0, 0.5, 0]}>
          <Rig url={M + 'blackboard.glb'} size={1.6} />
          <BoardWriting
            position={[-0.45, 0.92, 0.048]}
            rotation={[0, 0, -0.015]}
            width={0.95}
            lines={[
              { text: 'A+', size: 0.24 },
              { text: 'congrats, graduates!', size: 0.1 },
            ]}
          />
        </group>
      </group>

      <WorldPlane containerRef={containerRef} reducedMotion={reducedMotion} />
    </>
  );
}

export default function LandingScene({ containerRef, onReady }) {
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className="journey-canvas" aria-hidden="true">
      <Canvas
        shadows
        flat
        dpr={[1, 1.75]}
        camera={{ fov: 42, position: [0, 1.55, 7.5] }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ scene }) => {
          // fog swallows the NEXT stage during arrivals; text does its own
          // distance fade because troika's SDF shader ignores scene fog
          scene.fog = new THREE.Fog('#f3ecdd', 8, 18);
        }}
      >
        <Suspense fallback={null}>
          <World containerRef={containerRef} reducedMotion={reducedMotion} onReady={onReady} />
        </Suspense>
      </Canvas>
    </div>
  );
}
