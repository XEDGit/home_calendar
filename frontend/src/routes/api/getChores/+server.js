import { getBackend } from '#lib/requests.js';

export async function GET({ request }) {
    return await getBackend(request, 'chores')
}
