/**
 * EUNA Pilot — text hygiene for teacher-facing narration.
 *
 * The model is told never to speak internal element refs, but prompt rules
 * leak occasionally — a ref in chat text reads like gibberish to a teacher.
 * Scrub deterministically at render time AND before persisting the turn.
 */

export function scrubRefs(text = '') {
    let out = String(text)
        .replace(/\s*\(\s*\[\s*\d+\s*\]\s*\)/g, '') // "([9])"
        .replace(/\s*\[\s*\d+\s*\]/g, '')            // "[9]"
        .replace(/\s*\(\s*ref\s*\d+\s*\)/gi, '')     // "(ref 9)"
        .replace(/\b(?:ref|element)\s+#?\d+\b/gi, '') // "ref 9" / "element 12"
        .replace(/\s{2,}/g, ' ')
        .trim();
    // The model occasionally quotes its whole reply — one deterministic trim
    if (
        out.length > 1 &&
        ((out.startsWith('"') && out.endsWith('"')) ||
            (out.startsWith('\u201C') && out.endsWith('\u201D')))
    ) {
        out = out.slice(1, -1).trim();
    }
    return out;
}
