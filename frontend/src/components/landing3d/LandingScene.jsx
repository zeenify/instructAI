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
const INK = '#16130e';
const VERM = '#ff4b26';
const SAGE = '#3e8e7e';

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
function useStageFade(ref, worldZ) {
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    const d = Math.abs(state.camera.position.z - (worldZ + 7));
    const o = clamp01(1.25 - d * 0.13);
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
    g.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.8 + stageZ) * 0.03;
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

// ── stage signposts: coded paper markers so the path reads ──
function PathMarkers() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 24);
    const mat = new THREE.MeshStandardMaterial({ color: '#e6d9bf', roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(0, 0.03, -i * 14);
      g.add(m);
    }
    return g;
  }, []);
  return <primitive object={group} />;
}

// ── the paper plane circling the whole world overhead ──────
function WorldPlane() {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.13;
    const z = ((-t * 6) % 80) - 10;
    ref.current.position.set(Math.sin(state.clock.elapsedTime * 0.5) * 5.5, 4.6 + Math.sin(state.clock.elapsedTime * 0.9) * 0.4, -Math.abs(t * 6 % 80) + 8);
    ref.current.position.z = z;
    ref.current.rotation.y = Math.atan2(
      Math.cos(state.clock.elapsedTime * 0.5),
      -1.6,
    );
  });
  return (
    <group ref={ref}>
      <Rig url={M + 'paper-plane.glb'} size={0.5} rotation={[0.1, Math.PI, 0]} />
    </group>
  );
}

// ── stage 1 letters: real typeset Fraunces letters on the floor ──
function TypeStage({ stageZ }) {
  const group = useRef();
  const letters = useMemo(() => ([
    { ch: 'A', x: -3.4, z: -1.2, s: 0.85, c: VERM, r: 0.42 },
    { ch: 'a', x: -2.55, z: -0.5, s: 0.6, c: INK, r: -0.28 },
    { ch: 'B', x: -1.75, z: -1.0, s: 0.78, c: SAGE, r: 0.3 },
    { ch: 'b', x: -0.9, z: -0.45, s: 0.58, c: INK, r: -0.38 },
    { ch: 'C', x: -0.1, z: -1.1, s: 0.8, c: VERM, r: 0.22 },
    { ch: 'c', x: 0.7, z: -0.5, s: 0.5, c: INK, r: -0.2 },
  ]), []);

  useStageFade(group, stageZ);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.children.forEach((g, i) => {
      // a gentle wave runs through the type — schoolroom energy, not chaos
      g.position.y = Math.abs(Math.sin(t * 1.3 - i * 0.5)) * 0.12;
    });
  });

  return (
    <group ref={group}>
      {letters.map((l, i) => (
        <group key={i} position={[l.x, 0, l.z]} rotation={[0, l.r, 0]}>
          <Text
            font={F_ROMAN}
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

// ── the world ──────────────────────────────────────────────
const STAGE_DZ = 14;

function World({ containerRef, reducedMotion }) {
  const camera = useThree((s) => s.camera);
  const light = useRef();
  const lightTarget = useMemo(() => new THREE.Object3D(), []);
  const pointer = useRef({ x: 0, y: 0 });
  const book = useRef();
  const owl = useRef();

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

      {/* ── stage 1 · typography: headline + real Fraunces letters ── */}
      <group position={[0, 0, stages[1]]}>
        <StageText
          position={[0, 2.55, -0.2]}
          stageZ={stages[1]}
          size={0.52}
          lines={[
            { text: 'Teachers get a co-teacher.' },
            { text: 'Students get an arcade.', em: true },
          ]}
        />
        <TypeStage stageZ={stages[1]} />
      </group>

      {/* ── stage 2 · the magic book writes itself ── */}
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
        <Rig url={M + 'books-stack.glb'} size={0.6} position={[1.95, 0, -0.6]} rotation={[0, -0.5, 0]} />
      </group>

      {/* ── stage 3 · arena: blackboard classroom, trophy earned ── */}
      <group position={[0, 0, stages[3]]}>
        <StageText
          position={[0, 2.7, -0.5]}
          stageZ={stages[3]}
          size={0.6}
          lines={[
            { text: 'The room becomes' },
            { text: 'a game show.', em: true },
          ]}
        />
        <Rig url={M + 'blackboard.glb'} size={1.9} position={[-2.4, 0.02, -2.2]} rotation={[0, 0.15, 0]} />
        <Float amp={0.05} speed={1.2} tilt={0.02} drift={0.3}>
          <Rig url={M + 'trophy.glb'} size={0.62} position={[1.75, 0.02, 0.4]} />
        </Float>
        <Rig url={M + 'books-stack.glb'} size={0.55} position={[0.1, 0, -1.5]} rotation={[0, 0.2, 0]} />
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
          <Rig url={M + 'grad-cap.glb'} size={1.0} position={[1.6, 2.35, -0.6]} />
        </Float>
        <Rig url={M + 'books-stack.glb'} size={0.85} position={[1.8, 0, 0.2]} rotation={[0, -0.3, 0]} />
        <Rig url={M + 'blackboard.glb'} size={1.6} position={[-2.35, 0.02, -0.9]} rotation={[0, 0.5, 0]} />
      </group>

      <PathMarkers />
      <WorldPlane />
    </>
  );
}

export default function LandingScene({ containerRef }) {
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
          <World containerRef={containerRef} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
