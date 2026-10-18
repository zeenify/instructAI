#!/usr/bin/env node
// Keep-awake pinger for the Render free-tier services (Render sleeps any
// free instance after ~15 min without inbound traffic; a cold wake costs
// ~1 minute — fatal mid-presentation).
//
// Run it ONLY while prepping / presenting / testing that day, and stop it
// after (Ctrl+C): free instances share one monthly instance-hour pool, so
// pinging 24/7 all month would exhaust it.
//
// Usage:
//   node tools/keep-awake.mjs             # ping every 4 minutes until Ctrl+C
//   node tools/keep-awake.mjs --every=2   # custom interval in minutes
//   node tools/keep-awake.mjs --once      # one sweep and exit (smoke test)

const SERVICES = [
  {
    name: "AI service",
    url: "https://instruct-ai-pnqz.onrender.com/ai/characters",
    method: "GET",
  },
  {
    name: "Execution engine",
    url: "https://instruct-execute.onrender.com/languages",
    method: "GET",
  },
  {
    name: "Backend",
    // HEAD on the APK: real static-file response, zero bytes downloaded
    url: "https://instructai-backend.onrender.com/downloads/Cognify.apk",
    method: "HEAD",
  },
];

const args = process.argv.slice(2);
const once = args.includes("--once");
const everyArg = args.find((a) => a.startsWith("--every="));
const everyMin = everyArg ? Number(everyArg.split("=")[1]) || 4 : 4;

// The free-tier instance-hours pool is shared across the workspace — nag if
// someone leaves the pinger running forever.
const RUN_BUDGET_HOURS = 12;

function stamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

async function sweep() {
  await Promise.all(
    SERVICES.map(async (s) => {
      try {
        const res = await fetch(s.url, { method: s.method, signal: AbortSignal.timeout(90_000) });
        const ok = res.ok;
        const wasAsleep = res.status === 502 || res.status === 503;
        console.log(
          `[${stamp()}] ${ok ? "✓" : wasAsleep ? "⏳" : "✗"} ${s.name}: HTTP ${res.status}` +
            (wasAsleep ? " (was asleep — this ping wakes it, allow ~1 min)" : ok ? " alive" : " unexpected"),
        );
      } catch (err) {
        const reason = err?.name === "TimeoutError" ? "timed out (waking?)" : err?.cause?.code || err?.message;
        console.log(`[${stamp()}] ✗ ${s.name}: ${reason}`);
      }
    }),
  );
}

console.log(
  `Keep-awake: poking ${SERVICES.length} services every ${everyMin} min` +
    (once ? " (single sweep)" : " — Ctrl+C to stop"),
);
await sweep();
if (once) process.exit(0);

const timer = setInterval(sweep, everyMin * 60_000);
const stopAt = setTimeout(() => {
  console.log(`\nBeen running ${RUN_BUDGET_HOURS}h — stopping so the free instance-hour pool isn't drained. Restart if still needed.`);
  clearInterval(timer);
  process.exit(0);
}, RUN_BUDGET_HOURS * 3600_000);

process.on("SIGINT", () => {
  console.log(`\n[${stamp()}] Keep-awake stopped — services will sleep ~15 min from their last hit.`);
  clearInterval(timer);
  clearTimeout(stopAt);
  process.exit(0);
});
