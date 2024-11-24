import { postBackend } from "$lib/requests";

export async function POST({ request }) {
	return await postBackend(request, 'rooms')
}
