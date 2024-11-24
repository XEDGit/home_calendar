import { getBackend } from '$lib/requests';

export async function GET({ request }) {
    return await getBackend(request, 'rooms')
}
