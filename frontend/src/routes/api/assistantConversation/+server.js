import { getBackend } from '#lib/requests.js';

export async function GET({ request, url }) {
	const id = url.searchParams.get('id') || '';
	if (!/^[a-f0-9]{24}$/.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
	const read = url.searchParams.get('read') === '0' ? '?read=0' : '';
	return await getBackend(request, `assistant/conversations/${id}${read}`);
}
