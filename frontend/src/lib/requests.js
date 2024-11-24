import { json } from '@sveltejs/kit';

export async function getBackend(request, endpoint) {
	try {
		const backendResponse = await fetch('http://backend:3000/' + endpoint, {
			method: 'GET',
			headers: {
				'Authorization': request.headers.get('Authorization') || '',
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

        const backendResponse = await fetch('http://backend:3000/' + endpoint, {
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

export async function getFrontend(endpoint, toUpdate) {
	await fetch(endpoint, {
		method: 'GET',
	}).then(res => 
		res.json().then(json => {
			return json;
		})
	)
}