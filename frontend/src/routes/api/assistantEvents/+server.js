// The member's live assistant stream, passed straight through. When the
// browser disconnects, the upstream request is aborted so the backend drops
// its subscription.
export async function GET({ request }) {
	const upstream = new AbortController();
	request.signal.addEventListener('abort', () => upstream.abort(), { once: true });
	try {
		const backend = await fetch('https://backend:3000/assistant/events', {
			headers: { Cookie: request.headers.get('Cookie') || '' },
			signal: upstream.signal,
		});
		if (!backend.ok || !backend.body) {
			upstream.abort();
			return new Response(null, { status: backend.status || 502 });
		}
		const body = new ReadableStream({
			async start(controller) {
				const reader = backend.body.getReader();
				try {
					for (;;) {
						const { value, done } = await reader.read();
						if (done) break;
						controller.enqueue(value);
					}
				} catch {
					// aborted: browser left
				}
				try { controller.close(); } catch { /* already closed */ }
			},
			cancel() { upstream.abort(); },
		});
		return new Response(body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform',
				'X-Accel-Buffering': 'no',
			},
		});
	} catch {
		return new Response(null, { status: 502 });
	}
}
