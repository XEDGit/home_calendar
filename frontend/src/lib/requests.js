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

async function get(endpoint) {
	let res = await fetch('api/' + endpoint, {
		method: 'GET',
	})
	res = await res.json()
	return res
}


async function post(endpoint, data) {
	let res = await fetch('api/' + endpoint, {
		method: 'POST',
		body: JSON.stringify(data),
	})
	res = await res.json()
	return res
}

export async function delStats(_id) {
	return post('delStats', {id: _id})
}

export async function getStats() {
	return get('getStats')
}

export async function getRooms() {
	return get('getRooms')
}

export async function getUsers() {
	return get('getUsers')
}

export async function getChores() {
	return get('getChores')
}