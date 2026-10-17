import { postBackend } from "#lib/requests.js";

export async function POST({ request, cookies }) {
	return await postBackend(request, 'chores/sign')
}
