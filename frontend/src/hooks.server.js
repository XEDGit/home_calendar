const BACK_ENDPOINT = 'https://backend:3000/'

export async function handle({ event, resolve }) {
	const token = event.cookies.get('session');
  
	if (!token && event.url.pathname != '/login' && event.url.pathname != '/api/login') {
	  return Response.redirect(event.url.origin + '/login');
	}

	if (!token) {
		return resolve(event);
	}
	const verification = await fetch(BACK_ENDPOINT + 'verify', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({'token': token}, null, 2)
	})

	if (verification.status != 200) {
		return Response.redirect(event.url.origin + '/login');
	}
  
	return resolve(event);
  }