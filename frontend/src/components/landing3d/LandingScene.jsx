// The landing journey v2 — a continuous 3D world the camera travels through.
// One paper-colored path, five stages along the Z axis, fog between them.
// Scroll = camera dolly. Everything sits ON the ground; nothing floats.
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useAnimations } from '@react-three/drei';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { fittedClone, measureModel } from './fit.js';

const M = '/models/landing/';

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

// ── code-driven rotation for props (trophies, caps, globes) ──
function Spinner({ speed = 0.8, tumble = 0, children }) {
  const ref = useRef();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * speed;
    if (tumble) {
      ref.current.rotation.x = Math.sin(t * tumble) * 0.35;
      ref.current.rotation.z = Math.cos(t * tumble * 0.8) * 0.3;
    }
  });
  return <group ref={ref}>{children}</group>;
}

// ── skinned models whose bind pose is COLLAPSED (scale-compensated rigs
// where the animation itself poses the parts). Strategy: play the take
// unmodified and measure its full bounds by CPU-skinning sampled poses, so
// the whole performance fits the intended stage box.
function PoseRig({ url, size = 1.5, window: win, retint, ...props }) {
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
    const t0 = win ? win.start : 0;
    const span = win ? win.dur : dur;
    for (let i = 0; i <= steps; i++) {
      mixer.setTime(t0 + (i / steps) * span);
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
    action.time = t0;
    fitted.current = true;
    if (retint) {
      const [to] = retint;
      inner.current.traverse((o) => {
        if (o.isMesh && o.material && o.material.color) {
          const c = o.material.color;
          // hue-ish match for the purple hat
          if (c.b > 0.45 && c.r > 0.1 && c.r < 0.8 && c.g < 0.5 && c.b > c.g) {
            o.material.color = new THREE.Color(to);
          }
        }
      });
    }
  }, [actions, names, mixer, size, win, retint]);

  useFrame((_, dt) => {
    if (!fitted.current || !names.length) return;
    const action = actions[names[0]];
    if (!action) return;
    if (win) {
      action.time += dt;
      if (action.time >= win.start + win.dur) action.time = win.start;
    }
  });

  return (
    <group ref={outer} {...props}>
      <group ref={inner}>
        <primitive object={gltf.scene} />
      </group>
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

// ── stage 1 letters: toy blocks standing on the ground ─────
function LettersStage() {
  const gltf = useLoader(GLTFLoader, M + 'alphabet.glb');
  const group = useRef();
  const letters = useMemo(() => {
    const meshes = [];
    gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    // an arc of blocks standing on the ground, left of the path
    const layout = [
      [-2.9, 0.02, -1.1, 0.4], [-2.1, 0.02, -0.4, -0.2], [-1.35, 0.02, -1.3, 0.7],
      [-0.5, 0.02, -0.55, -0.5], [0.35, 0.02, -1.25, 0.3], [1.2, 0.02, -0.5, -0.35],
      [2.0, 0.02, -1.35, 0.55], [2.75, 0.02, -0.7, -0.15],
    ];
    return layout.map(([x, y, z, rot], i) => {
      const original = meshes[i % meshes.length];
      const clone = original.clone();
      // toy-block tints so the letters read against the paper fog
      const palette = ['#ff4b26', '#3e8e7e', '#16130e', '#ffd43b'];
      clone.material = clone.material.clone();
      clone.material.color = new THREE.Color(palette[i % palette.length]);
      // zero the local transform, then bake the original's world transform in
      // (applyMatrix4 premultiplies: matrix = worldMatrix * identity)
      clone.position.set(0, 0, 0);
      clone.rotation.set(0, 0, 0);
      original.updateWorldMatrix(true, false);
      clone.applyMatrix4(original.matrixWorld);
      // measure this letter and stand it on the ground
      const probe = new THREE.Group();
      probe.add(clone);
      const { box, center } = measureModel(probe);
      const h = box.max.y - box.min.y || 1;
      const k = (1.5 + (i % 3) * 0.4) / h;
      clone.scale.setScalar(k);
      const g = new THREE.Group();
      g.add(clone);
      g.position.set(x, -box.min.y * k, z);
      g.rotation.y = rot;
      g.userData = { phase: i * 1.31, baseY: -box.min.y * k };
      return g;
    });
  }, [gltf]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    let i = 0;
    group.current.children.forEach((g) => {
      // a gentle wave runs through the blocks — schoolroom energy, not chaos
      g.position.y = g.userData.baseY + Math.abs(Math.sin(t * 1.4 - i * 0.55)) * 0.16;
      i += 1;
    });
  });

  return <group ref={group}>{letters.map((l, i) => <primitive key={i} object={l} />)}</group>;
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
    const swayA = [0, 1.35, -1.35, 1.35, 0];
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
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-near={0.5}
        shadow-camera-far={40}
      />
      <hemisphereLight intensity={0.85} groundColor="#cbb894" />
      <directionalLight position={[-6, 4, 2]} intensity={0.45} color="#e8ecff" />

      {/* ── stage 0 · hero: the owl tutor on its perch ── */}
      <group position={[0, 0, stages[0]]}>
        <Rig url={M + 'books-stack.glb'} size={1.15} position={[0, 0, 0]} rotation={[0, 0.35, 0]} />
        <group ref={owl} position={[0, 0.78, -0.3]}>
          <PoseRig
            url={M + 'wizard-owl.glb'}
            size={0.42}
            retint={['#ff4b26']}
          />
        </group>
        <Rig url={M + 'pencil.glb'} size={0.6} position={[2.2, 0.02, 0.9]} rotation={[0, -0.7, 0]} />
      </group>

      {/* ── stage 1 · letters: blocks on the classroom floor ── */}
      <group position={[0, 0, stages[1]]}>
        <LettersStage />
      </group>

      {/* ── stage 2 · the magic book — plays its own float+stars loop ── */}
      <group position={[0, 0, stages[2]]}>
        <group ref={book}>
          <Rig
            url={M + 'magic-book.glb'}
            size={1.35}
            play
            position={[0, 0.55, -0.15]}
            rotation={[-0.1, -0.4, 0]}
          />
        </group>
        <Rig url={M + 'books-stack.glb'} size={0.7} position={[0.1, 0, -0.15]} rotation={[0, -0.5, 0]} />
      </group>

      {/* ── stage 3 · arena: blackboard + spinning trophy ── */}
      <group position={[0, 0, stages[3]]}>
        <Rig url={M + 'blackboard.glb'} size={2.6} position={[0, 0.02, -0.6]} rotation={[0, 0.15, 0]} />
        <Spinner speed={0.9}>
          <Rig url={M + 'trophy.glb'} size={0.62} position={[1.55, 0.02, 0.6]} />
        </Spinner>
        <Rig url={M + 'books-stack.glb'} size={0.55} position={[-1.9, 0.02, 0.7]} rotation={[0, 0.8, 0]} />
      </group>

      {/* ── stage 4 · graduation — the cap tumbles forever ── */}
      <group position={[0, 0, stages[4]]}>
        <Spinner speed={0.5} tumble={0.8}>
          <Rig url={M + 'grad-cap.glb'} size={1.5} position={[-0.4, 1.15, 0.6]} />
        </Spinner>
        <Rig url={M + 'books-stack.glb'} size={1.0} position={[0.9, 0, 0.4]} rotation={[0, -0.3, 0]} />
        <Rig url={M + 'blackboard.glb'} size={1.6} position={[-2.3, 0.02, -0.8]} rotation={[0, 0.5, 0]} />
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
          scene.fog = new THREE.Fog('#f3ecdd', 10, 24);
        }}
      >
        <Suspense fallback={null}>
          <World containerRef={containerRef} reducedMotion={reducedMotion} />
        </Suspense>
      </Canvas>
    </div>
  );
}
