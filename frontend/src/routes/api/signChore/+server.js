import { postBackend } from "$lib/requests";

export async function POST({ request, cookies }) {
	return await postBackend(request, 'chores/sign')
}
