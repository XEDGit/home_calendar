import { json } from '@sveltejs/kit';

export async function GET({ request }) {
    try {
        const backendResponse = await fetch('http://backend:3000/chores', {
            method: 'GET',
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
            },
        });
        const data = await backendResponse.json();

        return json(data, { status: backendResponse.status });
    } catch (error) {
        console.error('Error proxying request:', error);
        return json({ error: 'Failed to post data to backend' }, { status: 500 });
    }
}