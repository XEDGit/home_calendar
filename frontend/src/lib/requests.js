import { json } from '@sveltejs/kit';

const BACK_ENDPOINT = 'https://backend:3000/'

// Common backend
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

		const responseHeaders = new Headers();
        backendResponse.headers.forEach((value, name) => {
            responseHeaders.set(name, value);
        });

		return new Response(JSON.stringify(data), {
            status: backendResponse.status,
            headers: responseHeaders
        });
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

		const responseHeaders = new Headers();
        backendResponse.headers.forEach((value, name) => {
            responseHeaders.set(name, value);
        });

		return new Response(JSON.stringify(data), {
            status: backendResponse.status,
            headers: responseHeaders
        });
    } catch (error) {
        console.error('Error proxying request:', error);
        return json({ error: 'Failed to post data to backend' }, { status: 500 });
    }
}

// Common frontend
export async function getFrontend(endpoint) {
	const res = await fetch('api/' + endpoint, {
		method: 'GET',
	})
	const obj = await res.json()
	return obj
}

export async function postFrontend(endpoint, data) {
	let res = await fetch('api/' + endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(data),
	})
	res = await res.json()
	return res
}

// Stats
export async function delStats(_id) {
	return postFrontend('delStats', {id: _id})
}

export async function getStats() {
	return getFrontend('getStats')
}

// Rooms
export async function getRooms() {
	return getFrontend('getRooms')
}

// Users
export async function getUsers() {
	return getFrontend('getUsers')
}

// Chores
export async function getChores() {
	return getFrontend('getChores')
}

export async function signChore(data) {
	return postFrontend('signChore', data)
}

export async function delChore(data) {
	return postFrontend('delChore', data)
}

// Events
export async function getEvents() {
	return getFrontend('getEvents')
}

export async function addEvent(data) {
	return postFrontend('addEvent', data)
}

// Login
export async function verify(data) {
	return postFrontend('addEvent', data)
}
