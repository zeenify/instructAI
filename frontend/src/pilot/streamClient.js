/**
 * EUNA Pilot — stream client
 *
 * Reads the Python service's SSE stream (`data: {json}\n\n` lines) from a
 * plain fetch — the browser connects directly to FastAPI, never through
 * Laravel (artisan serve is a single worker; proxying streams wedges it).
 */

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
            const { done, value } = await reader.read();
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
                try {
                    yield JSON.parse(payload);
                } catch {
                    // A malformed frame must not kill the run — skip it
                }
            }
        }
    } finally {
        // Early exit (tool event ends the turn) — release the socket
        reader.cancel().catch(() => {});
    }
}
