import { postBackend } from '#lib/requests.js';

export async function POST({ request }) {
    return postBackend(request, 'deleteEvent');
}