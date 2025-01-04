import { json } from '@sveltejs/kit';

const BACK_ENDPOINT = 'https://backend:3000/'

export async function getBackend(request, endpoint) {
	try {
		const backendResponse = await fetch(BACK_ENDPOINT + endpoint, {
			method: 'GET',
			headers: {
				'Authorization': request.headers.get('Authorization') || '',
				'Cookie': request.headers.get('Cookie') || '',
			},
		});
		const data = await backendResponse.json();

		return json(data, { status: backendResponse.status });
	} catch (error) {
		console.error('Error proxying request:', error);
		return json({ error: 'Failed to get data from backend' }, { status: 500 });
	}
}

export async function postBackend(request, endpoint) {
	try {
        const body = await request.json();

        const backendResponse = await fetch(BACK_ENDPOINT + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': request.headers.get('Authorization') || '',
				'Cookie': request.headers.get('Cookie') || '',
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

export async function getFrontend(endpoint) {
	await fetch(endpoint, {
		method: 'GET',
	}).then(res => 
		res.json().then(json => {
			return json;
		})
	)
}