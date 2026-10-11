# Landing 3D overhaul — research playbook (Phase 1)

Research tour done in the ZCode browser: 7 sites studied visually + 4 technique/
performance write-ups. This doc is the design brief for the Phase-3 rewrite on
branch `feat/landing-3d`.

## Sites studied

| Site | What it teaches us |
|---|---|
| bruno-simon.com | One dark scene, one glowing accent. Physics objects as navigation. 60fps discipline — low-poly props, cheap shadows, everything reads instantly. |
| lusion.co | ONE persistent full-viewport WebGL canvas; DOM content scrolls above it. Hero = cluster of one repeated prop (cross-joints) in a tight 3-color palette (white/blue/black) with glossy studio lighting; camera drifts on scroll with inertia; "scroll to explore" affordance. |
| igloo.inc (Awwwards SOTY 2024) | Scroll = camera journey through a 3D world; depth fog for atmosphere; neon guide path leads the eye; HUD-style mono labels pinned over the scene; monochrome palette + single accent. |
| activetheory.net | A single organic shader "eye" on pure black. Restraint: one living element beats ten static ones. Motion is continuous even when idle (fluid breathing). |
| unseen.co | Dreamy pastel 3D world + film-grain overlay; big serif italic + sans mix OVER the 3D scene; DOM UI floats on canvas; emotional grading beats realism. Closest analog to our Paper & Ink palette. |
| apple.com/airpods-pro | Sticky full-bleed hero, huge type, one idea per viewport, product sequence scrubbed by scroll, sticky buy bar. Restraint is the luxury. |
| chaingpt.org | 3D mascot center-stage with HUD callout annotations pointing at it ("feature labels in space"); display text overlaps the model for depth; matte clay material + glow accents. |

## The playbook we're applying

1. **One hero canvas, one story.** Hero gets a single R3F scene: the InstructAI
   owl-tutor mascot perched on a stack of books, floating paper props orbiting it.
   Camera reacts subtly to mouse (Lusion); props parallax on scroll.
2. **Repeated simple props in a tight palette** — cream/ink/vermilion/marker-yellow
   (Paper & Ink), matte clay materials, soft studio light, gentle contact shadow.
   No realism, no PBR noise — stylized toon/clay like Lusion/ChainGPT.
3. **DOM text OVER 3D** (Unseen/Apple): headlines stay huge Fraunces; 3D lives
   behind/beside text, never under it. HUD/mono kickers preserved.
4. **Scroll choreography, not scroll traps**: framer-motion `useScroll`+
   `useTransform` on DOM (cheap), R3F idle animations + scroll-linked rotation for
   the hero canvas; section props (trophy, phone) get their own tiny canvases that
   pause off-screen (IntersectionObserver + frameloop demand).
5. **Performance rules** (R3F docs, Codrops, lastres.ai):
   `dpr={[1, 1.75]}`, compressed GLB (Draco/Meshopt via gltf-transform, textures ≤
   1024), reused geometries/materials, no per-frame setState (useFrame refs),
   pause every canvas when out of view or tab hidden, `prefers-reduced-motion`
   renders static poster state, mobile: fewer props + lower dpr.
6. **Mascot + annotation callouts** (ChainGPT) for the EUNA/AI-tutor story.
7. **Progressive feel**: intro animation (staggered prop drop-in, owl pop),
   continuous gentle idle (float/breathe) so the page feels alive at rest
   (Active Theory), never busy.

## Asset plan (Phase 2 — Meshy text-to-3D, GLB export)

Style anchor for every prompt: *"stylized toon clay render, soft matte material,
warm cream paper background, ink-dark accents, vermilion orange accent, cute
proportions, clean game-ready prop, centered, soft studio lighting"*.

Priority:
1. `owl-tutor` — chibi owl mascot, big round eyes, ink + vermilion accent (hero + EUNA tie-in)
2. `book-stack` — stack of 2-3 closed books with warm covers (owl's perch)
3. `pencil` — classic yellow-orange pencil (floating prop)
4. `coffee-mug` — cream mug with steam swirl (floating prop; footer motif "chalk, coffee and test cases")
5. `paper-plane` — folded paper plane (floating prop, motion)
6. `trophy` — small gold trophy (arena / live quiz section)

Stretch (if credits allow): `lightbulb` (how-it-works), `alphabet-block` letter A.

Post-process pipeline: download GLB → `npx gltf-transform` optimize (weld, prune,
draco/meshopt, texture resize 1024, ktx2 if worth it) → `frontend/public/models/landing/`.

## Canvas budget

Hero canvas (owl scene) + EUNA's existing canvas + up to 2 small section canvases
(trophy, phone) — each paused off-screen. ≤ 5 contexts total, compressed assets,
so RAM/GPU stays sane on a school laptop.
