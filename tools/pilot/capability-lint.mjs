#!/usr/bin/env node
/**
 * EUNA Pilot — capability-lint: keeps the pilot's knowledge in sync with the
 * real UI.
 *
 * The pilot can only know what it can do because pilot_capabilities.py says
 * so — it does not explore at runtime. That makes manifest drift a silent
 * bug class (the copy-content incident: the feature shipped, the manifest
 * never learned it, the pilot flatly denied it). This lint closes the loop
 * by grepping BOTH sides:
 *
 *   1. every feature-defining control must still exist in the frontend
 *      source under the exact label the manifest cites (renamed or removed
 *      control → fix the manifest in the same PR), and
 *   2. the manifest must actually mention the feature (new feature → add
 *      its facts in the same PR).
 *
 * Route-level parity has its own gate (tools/pilot/manifest-lint.mjs); this
 * one covers controls and flows. When a teacher-facing feature ships, add
 * its anchor row below — that is the whole maintenance cost.
 *
 * Run: node tools/pilot/capability-lint.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = readFileSync(
    join(root, 'instruct-ai-service', 'config', 'pilot_capabilities.py'),
    'utf8'
);

function collectSource(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collectSource(full, out);
        else if (/\.(jsx?|tsx?)$/.test(entry)) out.push(readFileSync(full, 'utf8'));
    }
    return out;
}

const FRONTEND = collectSource(join(root, 'frontend', 'src')).join('\n');

// Each anchor: `ui` = the exact user-visible control label that must exist in
// the frontend source; `manifest` = a regex the manifest must match to prove
// the pilot knows the feature.
const ANCHORS = [
    { feature: 'Copy content between classes', ui: 'Copy content', manifest: /Copy content/i },
    { feature: 'Copy modal — append mode', ui: 'Add to existing', manifest: /Add to existing/i },
    { feature: 'Copy modal — replace mode', ui: 'Replace current', manifest: /Replace current/i },
    { feature: 'Classwork creation', ui: 'New classwork', manifest: /New classwork/i },
    { feature: 'Classwork repost', ui: 'Post to another class', manifest: /posted to another class|repost/i },
    { feature: 'Course quiz creation (module)', ui: 'New quiz', manifest: /New quiz/i },
    { feature: 'Deadline behavior — hard', ui: 'Closes at deadline', manifest: /Closes at deadline/i },
    { feature: 'Deadline behavior — soft', ui: 'Late OK', manifest: /Late OK/i },
    { feature: 'Deadline preset', ui: 'End of week', manifest: /End of week/i },
    { feature: 'Live room start', ui: 'Start Room', manifest: /Start Room/i },
    { feature: 'Live room launch (card)', ui: 'Start live', manifest: /Start live/i },
    { feature: 'Live room close', ui: 'Close quiz', manifest: /Close quiz/i },
    { feature: 'Live room reopen (card)', ui: 'Reopen', manifest: /Reopen/i },
    { feature: 'Live code watcher', ui: 'Live Code', manifest: /Live Code/i },
    { feature: 'Course quiz passing score', ui: 'Passing score', manifest: /Passing score/i },
    { feature: 'Per-item AI tutor switch', ui: 'AI Tutor', manifest: /AI Tutor/i },
    { feature: 'Coding similarity check', ui: 'Similar submissions', manifest: /Similar submissions/i },
    { feature: 'Curriculum upload', ui: 'Non-programming', manifest: /Non-programming/i },
    { feature: 'Publishing — unpublish', ui: 'Return to draft', manifest: /Return to draft/i },
    { feature: 'Engagement roster', ui: 'At risk', manifest: /At risk/i },
];

let failures = 0;
for (const a of ANCHORS) {
    const inUi = FRONTEND.includes(a.ui);
    const inManifest = a.manifest.test(manifest);
    const ok = inUi && inManifest;
    if (!ok) failures += 1;
    const state = ok
        ? 'ok'
        : !inUi
            ? `UI MISSING — "${a.ui}" no longer exists in frontend/src (renamed/removed? fix the manifest + this anchor)`
            : `MANIFEST MISSING — the pilot doesn't know "${a.feature}" (add it to pilot_capabilities.py)`;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${a.feature}${ok ? '' : ' — ' + state}`);
}

if (failures > 0) {
    console.error(`\ncapability-lint: ${failures} drift(s) found — the manifest and the UI must agree.`);
    process.exit(1);
}
console.log(`\ncapability-lint: OK — ${ANCHORS.length} feature anchors match on both sides.`);
