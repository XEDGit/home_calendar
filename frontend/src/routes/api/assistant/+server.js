import { postBackend } from '#lib/requests.js';

// Stores and queues a question; the answer arrives on /api/assistantEvents
export async function POST({ request }) {
	return await postBackend(request, 'assistant');
}
