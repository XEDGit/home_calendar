// Voice input for the assistant: the recorded clip goes to the internal
// whisper.cpp server (it converts webm/ogg/mp4 itself), text comes back.
const WHISPER = 'http://whisper:8080/inference';
const MAX_BYTES = 5 * 1024 * 1024;
const LANGUAGES = new Set(['it', 'en', 'nl']);

async function transcribe(audio, type, language) {
	const form = new FormData();
	form.append('file', new Blob([audio], { type }), 'clip');
	form.append('response_format', 'verbose_json');
	form.append('language', language);
	form.append('temperature', '0');
	const res = await fetch(WHISPER, { method: 'POST', body: form });
	if (!res.ok) throw new Error(`whisper returned ${res.status}`);
	return res.json();
}

export async function POST({ request }) {
	const type = request.headers.get('Content-Type') || 'audio/webm';
	if (!type.startsWith('audio/')) {
		return Response.json({ error: 'Expected an audio clip' }, { status: 400 });
	}
	const audio = await request.arrayBuffer();
	if (!audio.byteLength || audio.byteLength > MAX_BYTES) {
		return Response.json({ error: 'The recording is empty or too long' }, { status: 400 });
	}

	try {
		let result = await transcribe(audio, type, 'auto');
		// Short clips sometimes get detected as a neighbouring language;
		// the household speaks Italian, English or Dutch, so retry as the
		// likeliest of those.
		const detected = String(result.language || '').slice(0, 2);
		if (!LANGUAGES.has(detected) && !['italian', 'english', 'dutch'].includes(result.language)) {
			const fallback = ['german', 'afrikaans', 'de', 'af'].includes(result.language) ? 'nl'
				: ['spanish', 'portuguese', 'es', 'pt'].includes(result.language) ? 'it' : 'en';
			result = await transcribe(audio, type, fallback);
		}
		return Response.json({ text: (result.text || '').replace(/\s+/g, ' ').trim(), language: result.language });
	} catch (error) {
		console.error('Error transcribing:', error);
		return Response.json({ error: 'Voice input is unavailable right now' }, { status: 502 });
	}
}
