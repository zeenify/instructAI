# Landing 3D scroll research — October 2026

Studied via the built-in browser (frame extraction from scripted scroll recordings).

## Lusion.co (primary reference)

Recorded a full scroll-through and studied extracted frames.

- **Hero**: one 3D showpiece inside an inset frame; DOM type is small and precise;
  a tiny mono "SCROLL TO EXPLORE" hint at the bottom.
- **Giant typographic moment**: "Bold Ideas, Brought to Life" — type at ~30% of
  viewport height IS the page content. No imagery competing with it.
- **One continuous 3D element** (a blue tube) threads the later sections,
  giving narrative continuity between otherwise separate moments.
- Very few words per moment; calm cream backgrounds; accent color used sparingly;
  "+" markers as texture. No jargon captions anywhere.

## bruno-simon.com / igloo.inc

- Bruno's is click-to-enter (not scroll) but confirms: one authored diorama with
  an invitation ("Click to start") feels alive and personal.
- igloo.inc is too GPU-heavy to capture in the in-app browser; skipped.

## What we applied

1. Fewer, bigger words in the world (headlines are 2 short lines max).
2. "SCROLL TO EXPLORE" mono hint at the hero tail (scrolls away naturally).
3. The paper plane threads the whole corridor as the continuous guide element
   (our version of Lusion's tube).
4. DOM storytelling removed — the journey's only DOM is the hero kicker, the
   choice cards, the hint, and the finale CTAs. All narrative lives in-world.
5. Letters spell words (TEACH / LEARN) instead of an alphabet sampler.
6. Refresh behavior: paper background pre-painted, journey DOM hidden until the
   world's first frame, scroll always starts at the top.
