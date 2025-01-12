const BACK_ENDPOINT = 'https://backend:3000/'

export async function handle({ event, resolve }) {
	const token = event.cookies.get('session');
  
	if (!token && event.url.pathname != '/login' && event.url.pathname != '/api/login') {
		console.log('Unauthorized connection on: ', event.url.pathname)
		if (event.url.pathname != '/')
			return new Response("'exit()", {status: 418, headers: {'Connection': 'close'},})
		else
			return Response.redirect(event.url.origin + '/login');
	}

	if (!token) {
		console.log('login connection')
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
		console.log('Bad token verification')
		// Reset cookie with token
		const res = new Response(null, {
			status: 302,
			headers: {
				'Location': event.url.origin + '/login',
				'Set-Cookie': 'session=; Path=/; Max-Age=0;'
			}
		});
		return res;
	}
  
	return resolve(event);
  }