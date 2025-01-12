const BACK_ENDPOINT = 'https://backend:3000/'
const LIMIT_UNAUTH = 10
import { promises as fs } from 'fs';

const blocked_ips = {}
const unauth_connections = {}

function blockIp(ip) {
	delete unauth_connections[ip]
	blocked_ips[ip] = [true, Date.now()];
	try {
		fs.appendFile('blocked_ips.log', ip + '\n', 'utf8');
	} catch {
		console.error('Could not log ' + ip + ' to blocked_ips.log')
	}
}

export async function handle({ event, resolve }) {
	const token = event.cookies.get('session');
  
	const ip = event.request.headers.get('x-forwarded-for')

	if (blocked_ips[ip] && blocked_ips[ip][0]) {
		const day = 1000 * 60 * 60 * 24;
		if (blocked_ips[ip][1] < Date.now() - day)
			delete blocked_ips[ip]
		else
			return new Response("Contact the administrator", {status: 418, headers: {'Connection': 'close'},})
	}

	if (!token && event.url.pathname != '/login' && event.url.pathname != '/api/login') {
		console.log('Unauthorized connection on: ', event.url.pathname)
		if (event.url.pathname != '/') {
			if (!unauth_connections[ip])
				unauth_connections[ip] = 0;
			unauth_connections[ip]++;
			console.log(ip + ': ' + unauth_connections[ip])
			if (unauth_connections[ip] >= LIMIT_UNAUTH)
				blockIp(ip)
		}
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