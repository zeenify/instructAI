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

// ── responsive stage fit ───────────────────────────────────
// One factor drives the whole mobile adaptation: props scale toward the
// stage center, the camera backs off a little, text pulls inward — so
// compositions stay fully on screen instead of being stripped at the edges.
const BASE_DIST = 7;

function useStageDist() {
  const { size: vp } = useThree();
  const aspect = vp.width / vp.height;
  const isNarrow = aspect < 0.9;
  const spread = Math.min(1, Math.max(0.5, aspect / 1.55));
  return { isNarrow, spread, dist: BASE_DIST + (1 - spread) * 4 };
}

// ── a model with skeleton-aware fit, grounded on y=0 ─────────
function Rig({ url, size = 1.7, byHeight = false, geomOnly = false, robust = true, play = false, hideMaterials, tint, ...props }) {
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

  // some baked models carry stray props (bookmarks, decals) — hide by material
  useEffect(() => {
    if (!hideMaterials || !group.current) return;
    group.current.traverse((o) => {
      if (o.isMesh && o.material && hideMaterials.includes(o.material.name)) o.visible = false;
    });
  }, [model, hideMaterials]);

  // recolor a model (e.g. the white paper plane on cream paper)
  useEffect(() => {
    if (!tint || !group.current) return;
    group.current.traverse((o) => {
      if (o.isMesh && o.material && 'color' in o.material) o.material.color.set(tint);
    });
  }, [model, tint]);

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
function useStageFade(ref, worldZ, dist, rate = 0.13) {
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.abs(state.camera.position.z - (worldZ + dist));
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
  const scale = Math.min(1, Math.max(0.7, aspect / 1.55));
  const { dist } = useStageDist();
  const visW = 2 * dist * Math.tan(((camera.fov || 42) * Math.PI) / 360) * aspect;
  // measured Fraunces advance varies ≈ 0.28–0.48 by string; bias the
  // estimate high (0.45) so multi-row blocks never overlap each other
  const maxWidth = Math.min(8, (visW / scale) * 0.92);
  // narrow screens pull side panels back toward center; mobile stage
  // layouts set their own explicit y positions
  const yBase = position[1];
  const xBase = position[0] * scale;

  const layout = useMemo(() => {
    let y = 0;
    return lines.map((l) => {
      const fs = l.size || size;
      const rows = Math.max(1, Math.ceil((l.text.length * fs * 0.45) / maxWidth));
      const slot = { ...l, fs, y, rows };
      y += rows * fs * 1.16 + gap * fs;
      return slot;
    });
  }, [lines, size, gap, maxWidth]);

  useStageFade(group, stageZ + position[2], dist);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    // the type breathes very slightly so it feels part of the world
    g.position.set(xBase, yBase + Math.sin(state.clock.elapsedTime * 0.8 + stageZ) * 0.03, position[2]);
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

// ── stage 1 letters: typeset Fraunces letters that SPELL something ──
// Desktop: TEACH (left) and LEARN (right) stand on the paper floor.
// Mobile: the words stack vertically, each under its own headline, and
// float mid-air in centered rows. Jittered sizes, depths and turns keep
// them hand-set rather than typeset-perfect.
function TypeStage({ stageZ, narrow, rows }) {
  const group = useRef();
  const { size: vp } = useThree();
  const aspect = vp.width / vp.height;
  const spread = Math.min(1, Math.max(0.7, aspect / 1.55));
  const { dist } = useStageDist();

  const letters = useMemo(() => {
    const palette = [VERM, INK, SAGE, INK];
    const make = (word, x0, y0, s0, sp0) =>
      word.split('').map((ch, i) => ({
        ch,
        x: x0 + i * sp0,
        y: y0,
        z: [-0.95, -0.3, -0.85, -0.25, -0.9][i % 5],
        s: [s0, s0 * 0.83, s0 * 1.1, s0 * 0.85, s0 * 1.02][i % 5],
        c: palette[i % palette.length],
        r: [-0.24, 0.3, -0.18, 0.26, -0.3][i % 5],
      }));
    if (narrow && rows) {
      // stacked mobile rows, centered on x=0
      const sp = 0.52;
      return rows.flatMap(({ word, y }) =>
        make(word, -((word.length - 1) * sp) / 2, y, 0.5, sp),
      );
    }
    return [
      ...make('TEACH', -3.55, 0, 0.82, 0.68),
      ...make('LEARN', 0.75, 0, 0.82, 0.68),
    ];
  }, [narrow, rows]);

  // fade faster than the headlines: keep the rows readable while the camera
  // is still approaching the stage
  useStageFade(group, stageZ, dist, 0.2);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.children.forEach((g, i) => {
      // a gentle wave runs through the words — schoolroom energy, not chaos
      g.position.y = letters[i].y + Math.abs(Math.sin(t * 1.3 - i * 0.5)) * 0.12;
    });
  });

  return (
    <group ref={group} scale={narrow ? 1 : spread}>
      {letters.map((l, i) => (
        <group key={i} position={[l.x, l.y, l.z]} rotation={[0, l.r, 0]}>
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
// Placement uses the board's green-face bounds measured from the GLB
// (face spans y 0.075..1.14 at size 1.9, z ≈ 0.008 — just in front of it).
function BoardWriting({ lines, boardSize, cy, z }) {
  // placement ratios measured from the GLB green face (for size 1.9:
  // face spans y 0.075..1.14, center 0.61, z ≈ 0.008)
  const cyFinal = cy ?? 0.32 * boardSize;
  const zFinal = z ?? 0.02 + 0.0043 * boardSize;
  const k = boardSize / 1.9;
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
      text.clipRect = [-w / 2 - 0.02, -h / 2 - 0.02, -w / 2 + w * p + 0.02, h / 2 + 0.02];
    });
  });

  const step = Math.max(...lines.map((l) => l.size)) * k * 1.55;
  return (
    <group position={[0, cyFinal, zFinal]}>
      {lines.map((l, i) => (
        <Text
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          font={F_CHALK}
          fontSize={(l.size || 0.16) * k}
          color={CHALK}
          anchorX="center"
          anchorY="middle"
          position={[0, -((i - (lines.length - 1) / 2) * step), 0.001]}
        >
          {l.text}
        </Text>
      ))}
    </group>
  );
}

// ── the world ──────────────────────────────────────────────
const STAGE_DZ = 14;

function World({ containerRef, reducedMotion, onReady }) {
  const camera = useThree((s) => s.camera);
  const { isNarrow, spread, dist } = useStageDist();
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
    const camZ = lerp(stages[k] + dist, stages[k + 1] + dist, frac);
    // lateral sway so the stage sits opposite the text panel; on phones the
    // view centers on each stage's vertical stack instead
    const swayA = [0, 0, 1.35, 0, 0];
    const lookA = isNarrow ? [1.3, 2.3, 1.9, 1.5, 1.35] : [0.95, 0.95, 0.95, 0.95, 0.95];
    const sway = lerp(swayA[k], swayA[k + 1], frac);
    const lookY = lerp(lookA[k], lookA[k + 1], frac);
    const drift = reducedMotion ? 0 : 1;
    const targetX = (isNarrow ? 0 : sway * spread) + pointer.current.x * 0.3 * drift;
    const targetY = 1.55 + pointer.current.y * 0.18 * drift + Math.sin(t * 0.4) * 0.04;
    camera.position.x = lerp(camera.position.x, targetX, 0.05);
    camera.position.y = lerp(camera.position.y, targetY, 0.05);
    camera.position.z = camZ;
    camera.lookAt((isNarrow ? 0 : sway * 0.55 * spread), lookY, camZ - dist);

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
      owl.current.position.y = (isNarrow ? 1.3 : 0.95) + Math.sin(t * 1.1) * 0.04;
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
          position={[0, isNarrow ? 4.15 : 2.98, -1.9]}
          stageZ={stages[0]}
          size={isNarrow ? 0.62 : 0.7}
          lines={[
            { text: 'Your classroom,' },
            { text: 'assisted with AI.', em: true },
          ]}
        />
        <group scale={isNarrow ? 1 : spread}>
          <Rig
            url={M + 'books-stack.glb'}
            size={isNarrow ? 1.55 : 1.15}
            hideMaterials={['mat1', 'mat17']}
            position={[0, 0, isNarrow ? 0.2 : 0]}
            rotation={[0, 0.35, 0]}
          />
          <group ref={owl} position={[0, isNarrow ? 1.3 : 0.95, isNarrow ? -0.1 : -0.3]}>
            <PoseRig url={M + 'wizard-owl.glb'} size={isNarrow ? 0.62 : 0.42} />
          </group>
          <Rig
            url={M + 'pencil.glb'}
            size={isNarrow ? 0.75 : 0.6}
            position={isNarrow ? [1.35, 0.02, 0.9] : [2.2, 0.02, 0.9]}
            rotation={[0, -0.7, 0]}
          />
        </group>
      </group>

      {/* ── stage 1 · built for teachers / TEACH, built for students / LEARN ── */}
      <group position={[0, 0, stages[1]]}>
        {isNarrow ? (
          <>
            <StageText
              position={[0, 4.55, -0.3]}
              stageZ={stages[1]}
              size={0.5}
              lines={[{ text: 'Built for teachers.' }]}
            />
            <TypeStage
              stageZ={stages[1]}
              narrow
              rows={[{ word: 'TEACH', y: 3.15 }]}
            />
            <StageText
              position={[0, 1.7, -0.3]}
              stageZ={stages[1]}
              size={0.5}
              lines={[{ text: 'Built for students.', em: true }]}
            />
            <TypeStage
              stageZ={stages[1]}
              narrow
              rows={[{ word: 'LEARN', y: 0.2 }]}
            />
          </>
        ) : (
          <>
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
          </>
        )}
      </group>

      {/* ── stage 2 · upload a curriculum, get lessons and quizzes ── */}
      <group position={[0, 0, stages[2]]}>
        <StageText
          position={isNarrow ? [0, 3.7, -0.5] : [-1.95, 2.2, -0.5]}
          stageZ={stages[2]}
          size={0.5}
          lines={[
            { text: 'Upload your curriculum.' },
            { text: 'Get lessons and quizzes.', em: true },
          ]}
        />
        <group scale={isNarrow ? 1 : spread}>
          <group ref={book}>
            <Rig
              url={M + 'magic-book.glb'}
              size={isNarrow ? 1.2 : 1.1}
              play
              position={isNarrow ? [0, 0.08, -0.2] : [1.7, 0.55, -0.15]}
              rotation={isNarrow ? [-0.08, 0.12, 0] : [-0.1, -0.4, 0]}
            />
          </group>
          <Float amp={0.07} speed={1.3} tilt={0.06} drift={0.35}>
            <Rig
              url={M + 'pencil.glb'}
              size={isNarrow ? 0.7 : 0.55}
              position={isNarrow ? [1.2, 0.8, 0.4] : [0.6, 1.5, 0.55]}
              rotation={[0.6, isNarrow ? -0.9 : -1.2, 0.5]}
            />
          </Float>
          {!isNarrow && (
            <Rig url={M + 'books-stack.glb'} size={0.6} hideMaterials={['mat1', 'mat17']} position={[1.95, 0, -0.6]} rotation={[0, -0.5, 0]} />
          )}
        </group>
      </group>

      {/* ── stage 3 · live quizzes, the class on one leaderboard ── */}
      <group position={[0, 0, stages[3]]}>
        <StageText
          position={[0, isNarrow ? 3.9 : 2.7, -0.5]}
          stageZ={stages[3]}
          size={isNarrow ? 0.52 : 0.6}
          lines={[
            { text: 'Live quizzes, points,' },
            { text: 'and a leaderboard.', em: true },
          ]}
        />
        <group scale={isNarrow ? 1 : spread}>
          <group
            position={isNarrow ? [0, 0.02, -0.9] : [-2.6, 0.02, -2.2]}
            rotation={[0, isNarrow ? 0.05 : 0.15, 0]}
          >
            <Rig url={M + 'blackboard.glb'} size={isNarrow ? 2.6 : 2.3} />
            <BoardWriting
              boardSize={isNarrow ? 2.6 : 2.3}
              lines={[
                { text: 'QUIZ DAY', size: 0.2 },
                { text: 'friday, last period', size: 0.115 },
              ]}
            />
          </group>
          <Float amp={0.05} speed={1.2} tilt={0.02} drift={0.3}>
            <Rig
              url={M + 'trophy.glb'}
              size={isNarrow ? 0.72 : 0.62}
              position={isNarrow ? [1.35, 0.02, 0.55] : [1.75, 0.02, 0.4]}
            />
          </Float>
        </group>
      </group>

      {/* ── stage 4 · graduation — the cap tossed high, forever ── */}
      <group position={[0, 0, stages[4]]}>
        <StageText
          position={[0, isNarrow ? 2.75 : 2.0, -0.3]}
          stageZ={stages[4]}
          size={0.66}
          lines={[
            { text: 'Ready to' },
            { text: 'start?', em: true },
          ]}
        />
        <group scale={isNarrow ? 1 : spread}>
          <Float amp={0.12} speed={0.9} tilt={0.08} drift={0.45}>
            <Rig
              url={M + 'grad-cap.glb'}
              size={isNarrow ? 1.25 : 1.0}
              position={isNarrow ? [0.62, 1.52, -0.5] : [2.05, 1.55, -0.6]}
            />
          </Float>
          <Rig
            url={M + 'books-stack.glb'}
            size={isNarrow ? 1.1 : 0.85}
            hideMaterials={['mat1', 'mat17']}
            position={isNarrow ? [-0.72, 0.14, 0.35] : [1.8, 0, 0.2]}
            rotation={[0, isNarrow ? 0.4 : -0.3, 0]}
          />
          {!isNarrow && (
            <group position={[-2.55, 0.02, -0.9]} rotation={[0, 0.5, 0]}>
              <Rig url={M + 'blackboard.glb'} size={1.9} />
              <BoardWriting
                boardSize={1.9}
                lines={[
                  { text: 'YOUR CLASS', size: 0.19 },
                  { text: 'is waiting.', size: 0.11 },
                ]}
              />
            </group>
          )}
        </group>
      </group>

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
