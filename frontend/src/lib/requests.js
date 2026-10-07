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

// In-flight tracking: page transitions wait briefly for a new view's first
// fetches, so the view arrives with its data instead of popping in later.
let inFlight = 0;
const idleWaiters = new Set();

function track(promise) {
	inFlight++;
	return promise.finally(() => {
		inFlight--;
		if (inFlight !== 0) return;
		// Give chained requests (await a; await b) a tick to start before calling it idle
		setTimeout(() => {
			if (inFlight !== 0) return;
			for (const resolve of idleWaiters) resolve();
			idleWaiters.clear();
		}, 0);
	});
}

/** Resolves once no client requests are pending, or after `maxWait` ms. */
export function networkIdle(maxWait = 300) {
	return new Promise((resolve) => {
		const timer = setTimeout(done, maxWait);
		function done() {
			clearTimeout(timer);
			idleWaiters.delete(done);
			resolve();
		}
		setTimeout(() => (inFlight === 0 ? done() : idleWaiters.add(done)), 0);
	});
}

// Common frontend
export function getFrontend(endpoint) {
	return track(
		fetch('api/' + endpoint, {
			method: 'GET',
		}).then((res) => res.json())
	);
}

export function postFrontend(endpoint, data) {
	return track(
		fetch('api/' + endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		}).then((res) => res.json())
	);
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

// Save the current member's colour theme (a palette id from $lib/theme.js)
export async function updateTheme(theme) {
	return postFrontend('updateTheme', { theme })
}

// Chores
export async function getChores() {
	return getFrontend('getChores')
}

export async function signChore(data) {
	return postFrontend('signChore', data)
}

export async function skipChore(data) {
	return postFrontend('skipChore', data)
}

export async function delChore(data) {
	return postFrontend('delChore', data)
}

// Todos
export async function getTodos() {
	return getFrontend('getTodos')
}

export async function addTodo(data) {
	return postFrontend('addTodo', data)
}

export async function updateTodo(data) {
	return postFrontend('updateTodo', data)
}

export async function deleteTodo(data) {
	return postFrontend('delTodo', data)
}

// Tags
export async function getTags() {
	return getFrontend('getTags')
}

// Events
export async function getEvents(startDate, endDate) {
	let endpoint = 'getEvents';
	if (startDate && endDate) {
		endpoint += `?startDate=${startDate}&endDate=${endDate}`;
	}
	return getFrontend(endpoint);
}

export async function addEvent(data) {
	return postFrontend('addEvent', data)
}

export async function updateEvent(data) {
	return postFrontend('updateEvent', data)
}

export async function deleteEvent(data) {
	return postFrontend('deleteEvent', data)
}

// Automations
export async function getAutomations() {
	return getFrontend('getAutomations')
}

export async function addAutomation(data) {
	return postFrontend('addAutomation', data)
}

export async function updateAutomation(data) {
	return postFrontend('updateAutomation', data)
}

export async function deleteAutomation(id) {
	return postFrontend('delAutomation', { id })
}

export async function runAutomation(id) {
	return postFrontend('runAutomation', { id })
}

// Login
export async function verify(data) {
	return postFrontend('addEvent', data)
}
