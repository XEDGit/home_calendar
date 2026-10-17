import { postBackend } from "#lib/requests.js";

export async function POST({ request }) {
	return await postBackend(request, 'events')
}
