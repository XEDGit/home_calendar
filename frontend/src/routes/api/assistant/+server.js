import { json } from '@sveltejs/kit';

// Streams the assistant's server-sent events straight through
export async function POST({ request }) {
	try {
		const backendResponse = await fetch('https://backend:3000/assistant', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Cookie': request.headers.get('Cookie') || '',
			},
			body: JSON.stringify(await request.json()),
		});
		return new Response(backendResponse.body, {
			status: backendResponse.status,
			headers: {
				'Content-Type': backendResponse.headers.get('Content-Type') || 'application/json',
				'Cache-Control': 'no-cache, no-transform',
				'X-Accel-Buffering': 'no',
			},
		});
	} catch (error) {
		console.error('Error proxying assistant request:', error);
		return json({ error: 'The assistant is unavailable right now' }, { status: 502 });
	}
}
