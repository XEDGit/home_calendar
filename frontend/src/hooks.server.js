const BACK_ENDPOINT = 'https://backend:3000/'
const LIMIT_UNAUTH = 10
import { promises as fs } from 'fs';
import { redirect } from '@sveltejs/kit';

class Blacklist {
	constructor(old_blacklist) {
		if (typeof old_blacklist !== 'object' || !old_blacklist.iplist) {
			this.iplist = {};
		} else {
			this.iplist = old_blacklist.blacklist;
		}
	}

	add(ip) {
		if (!this.iplist[ip]) {
			this.iplist[ip] = {
				blocked: false,
				date: null,
				infractions: []
			};
		}
	}

	async block(ip) {
		const date = Date.now().toLocaleString('en-EN');
		this.add(ip);
		this.iplist[ip].blocked = true;
		this.iplist[ip].date = date;
		console.log('Blocked ' + ip + ' on ' + date);
		try {
			await fs.writeFile(BLOCKED_IPS_LOG, JSON.stringify(this, null, 2), {encoding: 'utf8'});
		} catch (err) {
			console.error('Could not write ips to ' + BLOCKED_IPS_LOG + ' because of: ' + err)
		}
	}

	isBlocked(ip) {
		return this.get(ip)?.blocked || false;
	}

	get(ip) {
		return this.iplist[ip] || null;
	}

	addInfraction(ip, link) {
		this.add(ip);
		date = Date.now().toLocaleString('en-EN');
		this.iplist[ip].infractions.push([date, link]);
		console.log('Added infraction for ' + ip + ' on ' + link);
		if (this.iplist[ip].infractions.length >= LIMIT_UNAUTH) {
			this.block(ip);
		}
	}
}

const BLOCKED_IPS_LOG = 'blocked_ips.log';
let blacklist = null;

(async () => {
	try {
		const blocked_from_file = await fs.readFile(BLOCKED_IPS_LOG, {encoding: 'utf8'})
		const tmp_blacklist = JSON.parse(blocked_from_file);
		blacklist = new Blacklist(tmp_blacklist);
		console.error(`Loaded blocked ips`)
	} catch (err) {
		console.error(`Couldn't load blocked ips because: ${err}`)
	}
})()

export async function handle({ event, resolve }) {
	if (blacklist === null) {
		console.error('Blacklist is not initialized')
		return new Response("Initializing", {status: 500, headers: {'Connection': 'close'},});
	}

	const token = event.cookies.get('session');
  
	const ip = event.request.headers.get('x-forwarded-for')

	if (blacklist.isBlocked(ip)) {
		return new Response("Contact the administrator", {status: 418, headers: {'Connection': 'close'},})
	}

	if (!token && event.url.pathname != '/login' && event.url.pathname != '/api/login') {
		console.log('Unauthorized connection on: ', event.url.pathname)
		if (event.url.pathname != '/') {
			blacklist.addInfraction(ip, event.url.pathname);
		}
		return Response.redirect(event.url.origin + '/login');
	} else if (!token) {
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
		event.cookies.delete('session', { path: '/' });
		throw redirect(302, event.url.origin + '/login');
	}
  
	return resolve(event);
  }