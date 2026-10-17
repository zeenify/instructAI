/**
 * EUNA Pilot — stream client
 *
 * Reads the Python service's SSE stream (`data: {json}\n\n` lines) from a
 * plain fetch — the browser connects directly to FastAPI, never through
 * Laravel (artisan serve is a single worker; proxying streams wedges it).
 *
 * Two safety rules learned the hard way: the `finish` event is TERMINAL
 * (never wait for EOF — keep-alive makes stream end unreliable, same reason
 * the tutor stream carries an end marker), and every read races an inactivity
 * watchdog so a stalled socket surfaces as an honest error instead of an
 * eternally locked composer.
 */

// A silent gap longer than the service's own 120s model timeout means the
// stream is dead in the water — nothing legitimate arrives after this long.
const STALL_MS = 130000;

async function readWithStallGuard(reader) {
    let timer;
    try {
        return await Promise.race([
            reader.read(),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('stream stalled')), STALL_MS);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

export async function* streamEvents(url, body, signal) {
    let res;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal,
        });
    } catch (err) {
        if (err?.name === 'AbortError') throw err;
        throw new Error('AI service unreachable');
    }

    if (!res.ok || !res.body) {
        throw new Error(`stream failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await readWithStallGuard(reader);
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sep;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
                const frame = buffer.slice(0, sep);
                buffer = buffer.slice(sep + 2);
                const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
                if (!dataLine) continue;
                const payload = dataLine.slice(5).trim();
                if (!payload) continue;
                let ev;
                try {
                    ev = JSON.parse(payload);
                } catch {
                    continue; // A malformed frame must not kill the run — skip it
                }
                yield ev;
                // finish is the last frame the server ever sends for this
                // turn — stop reading instead of hanging on keep-alive EOF
                if (ev?.type === 'finish') return;
            }
        }
    } finally {
        // Early exit (tool event or finish ends the turn) — release the socket
        reader.cancel().catch(() => {});
    }
}
