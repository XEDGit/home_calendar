import { postBackend } from "$lib/requests";

export async function POST({ request }) {
	// console.log('asdasd')
	return await postBackend(request, 'chores/del')
}
