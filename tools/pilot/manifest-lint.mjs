#!/usr/bin/env node
/**
 * EUNA Pilot — capability-manifest parity lint
 *
 * The agent's knowledge of the dashboard (config/pilot_capabilities.py
 * ROUTES) must match the routes that actually exist in App.jsx. When a page
 * is renamed or removed, this fails — the manifest gets fixed in the same
 * PR, exactly like the CSS-architecture rule.
 *
 * Route segments are matched structurally: param NAMES may differ between
 * the manifest and the router (`:classId` vs `:id`), the shape may not.
 *
 * Run: node tools/pilot/manifest-lint.mjs
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const appJsx = readFileSync(join(root, 'frontend', 'src', 'App.jsx'), 'utf8');
const capsPy = readFileSync(join(root, 'instruct-ai-service', 'config', 'pilot_capabilities.py'), 'utf8');

// Pull ROUTES keys out of the Python manifest
const manifestPaths = [...capsPy.matchAll(/^\s{4}"(\/[^"]+)":/gm)].map((m) => m[1]);
if (manifestPaths.length === 0) {
    console.error('manifest-lint: no ROUTES found in pilot_capabilities.py');
    process.exit(1);
}

// Every declared route path in App.jsx, normalized to `seg/*` for params
const appRoutes = new Set(
    [...appJsx.matchAll(/path="([^"]+)"/g)].map((m) => m[1].replace(/:[^/]+/g, '*'))
);

const TEACHER_PREFIX = '/dashboard/teacher';

// The layout itself is declared with the absolute path
const layoutDeclared = appRoutes.has(TEACHER_PREFIX);

const problems = [];

for (const manifestPath of manifestPaths) {
    if (!manifestPath.startsWith(TEACHER_PREFIX)) {
        problems.push(`${manifestPath} — manifest entry outside ${TEACHER_PREFIX} (agent scope is the teacher dashboard)`);
        continue;
    }

    const rel = manifestPath.slice(TEACHER_PREFIX.length).replace(/^\//, '');
    if (rel === '') {
        if (!layoutDeclared) problems.push(`${manifestPath} — no <Route path="${TEACHER_PREFIX}"> layout route in App.jsx`);
        continue;
    }
    if (!appRoutes.has(rel.replace(/:[^/]+/g, '*'))) {
        problems.push(`${manifestPath} — no matching relative route "${rel}" under ${TEACHER_PREFIX} in App.jsx (renamed or removed?)`);
    }
}

if (problems.length > 0) {
    console.error('manifest-lint: capability manifest is out of sync with App.jsx:');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
}

console.log(`manifest-lint: OK — ${manifestPaths.length} manifest entries match App.jsx routes`);
