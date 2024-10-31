import { json } from '@sveltejs/kit';

export async function POST({ request }) {
    try {
        const body = await request.json();
        const backendResponse = await fetch('http://backend:3000/chores/sign', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': request.headers.get('Authorization') || '',
            },
            body: JSON.stringify(body)
        });

        const data = await backendResponse.json();
        return json(data, { status: backendResponse.status });
    } catch (error) {
        console.error('Error proxying request:', error);
        return json({ error: 'Failed to post data to backend' }, { status: 500 });
    }
}