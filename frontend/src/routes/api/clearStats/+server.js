import { getBackend } from '$lib/requests';

export async function POST({ request }) {
    return await getBackend(request, 'chores/stats/clear')
}
