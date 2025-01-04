import { getBackend } from '$lib/requests';

export async function GET({ request }) {
    return await getBackend(request, 'chores/dbg')
}

export async function POST({ request }) {
    return await getBackend(request, 'chores/dbg')
}