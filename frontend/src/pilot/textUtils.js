/**
 * EUNA Pilot — text hygiene for teacher-facing narration.
 *
 * The model is told never to speak internal element refs or record ids, but
 * prompt rules leak occasionally — a ref in chat text reads like gibberish,
 * and a record id ("class ID 83") reads like a database leak. Scrub both
 * deterministically at render time AND before persisting the turn.
 */

export function scrubRefs(text = '') {
    let out = String(text)
        .replace(/\s*\(\s*\[\s*\d+\s*\]\s*\)/g, '') // "([9])"
        .replace(/\s*\[\s*\d+\s*\]/g, '')            // "[9]"
        .replace(/\s*\(\s*ref\s*\d+\s*\)/gi, '')     // "(ref 9)"
        .replace(/\b(?:ref|element)\s+#?\d+\b/gi, '') // "ref 9" / "element 12"
        // Record ids — "(id 83)", "(ID: 83)" after a name
        .replace(/\s*\(\s*(?:id|ID)\s*[:#]?\s*\d+\s*\)/g, '')
        // "class ID 83" / "student id 45" → just the entity word
        .replace(/\b(class|student|quiz|activity|course)\s+(?:id|ID|Id)\s*[:#]?\s*\d+\b/g, '$1')
        // "quiz #12" → the entity word
        .replace(/\b(class|student|quiz|activity|course)\s+#\d+\b/gi, '$1')
        // Bare "ID: 83" / "id #83"
        .replace(/\b(?:id|ID)\s*[:#]\s*\d+\b/g, '')
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
