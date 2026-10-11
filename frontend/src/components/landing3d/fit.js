// Skeleton-aware model fitting — Box3.setFromObject lies for skinned meshes,
// so we measure bones + CPU-skinned vertex samples instead.
import * as THREE from 'three';

export function measureModel(root, { geomOnly = false, robust = true } = {}) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  // robust percentile bounds (stray rig bones can throw single vertices to
  // ±1000; min/max would explode the fit) — disable for scale-compensated rigs
  const xs = [];
  const ys = [];
  const zs = [];
  const useArrays = robust;
  const push = (vec) => {
    if (useArrays) { xs.push(vec.x); ys.push(vec.y); zs.push(vec.z); }
    else box.expandByPoint(vec);
  };
  const finish = () => {
    if (!useArrays) return;
    const pick = (arr, q) => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
    };
    if (xs.length) {
      box.min.set(pick(xs, 0.02), pick(ys, 0.02), pick(zs, 0.02));
      box.max.set(pick(xs, 0.98), pick(ys, 0.98), pick(zs, 0.98));
    }
  };
  root.traverse((o) => {
    if (o.isSkinnedMesh && o.geometry && !geomOnly) {
      const pos = o.geometry.attributes.position;
      const count = pos.count;
      const step = Math.max(1, Math.floor(count / 300));
      for (let i = 0; i < count; i += step) {
        v.fromBufferAttribute(pos, i);
        if (o.applyBoneTransform) o.applyBoneTransform(i, v);
        else v.applyMatrix4(o.bindMatrix);
        v.applyMatrix4(o.matrixWorld);
        push(v);
      }
    } else if (o.isMesh) {
      o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      for (const cx of [b.min.x, b.max.x]) for (const cy of [b.min.y, b.max.y]) for (const cz of [b.min.z, b.max.z]) {
        v.set(cx, cy, cz).applyMatrix4(o.matrixWorld);
        push(v);
      }
    } else if (o.isBone && !geomOnly) {
      o.getWorldPosition(v);
      push(v);
    }
  });
  finish();
  if (box.isEmpty()) box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return { box, size, center, maxDim: Math.max(size.x, size.y, size.z) || 1 };
}

// Wraps a loaded glTF scene. byHeight=true (characters) scales so bbox height =
// targetSize; byHeight=false (props) scales so bbox max dimension = targetSize.
// Feet (bbox min Y) land on y=0, centered on x/z.
// Returns { wrap, height, width }.
export function fittedClone(scene, targetSize = 1.7, byHeight = false, geomOnly = false, robust = true) {
  // SkinnedMesh.clone() keeps bone references pointing at the ORIGINAL scene's
  // bones (three.js does not remap them), which collapses the clone to a point.
  // So: skinned scenes are used un-cloned; only static ones are cloned.
  let hasSkinned = false;
  scene.traverse((o) => { if (o.isSkinnedMesh) hasSkinned = true; });
  const s = hasSkinned ? scene : scene.clone(true);
  const { box, size, center } = measureModel(s, { geomOnly, robust });
  const ref = byHeight ? Math.max(size.y, 0.0001) : Math.max(size.x, size.y, size.z, 0.0001);
  const k = targetSize / ref;
  s.scale.setScalar(k);
  const wrap = new THREE.Group();
  wrap.add(s);
  s.position.set(-center.x * k, -box.min.y * k, -center.z * k);
  return { wrap, height: size.y * k, width: size.x * k };
}
