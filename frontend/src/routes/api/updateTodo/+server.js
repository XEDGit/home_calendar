import { postBackend } from '$lib/requests';

export async function POST({ request }) {
    return postBackend(request, 'updateTodo');
}