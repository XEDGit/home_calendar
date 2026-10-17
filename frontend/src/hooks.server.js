const BACK_ENDPOINT = 'https://backend:3000/'
const LIMIT_UNAUTH = 10
const MAX_TRACKED_IPS = 10000
const MAX_INFRACTIONS = 50
import { promises as fs } from 'fs';
import { clientIp } from '#lib/server/clientIp.js';
import { redirect } from '@sveltejs/kit';
import { THEMES, themeStyle } from '#lib/theme.js';

class Blacklist {
	constructor(old_blacklist) {
		if (typeof old_blacklist !== 'object' || !old_blacklist.iplist) {
			this.iplist = {};
		} else {
			this.iplist = old_blacklist.iplist;
		}
	}

	add(ip) {
		if (!(ip in this.iplist)) {
			// Bound memory/disk growth: an attacker rotating source IPs cannot
			// grow the table without limit. Evict an arbitrary unblocked entry.
			if (Object.keys(this.iplist).length >= MAX_TRACKED_IPS) {
				const evictable = Object.keys(this.iplist).find((k) => !this.iplist[k].blocked);
				if (evictable) delete this.iplist[evictable];
				else return false;
			}
			this.iplist[ip] = {
				blocked: false,
				date: null,
				infractions: []
			};
		}
		return true;
	}

	async saveToDisk() {
		try {
			await fs.writeFile(BLOCKED_IPS_LOG, JSON.stringify(this, null, 2), {encoding: 'utf8'});
		} catch (err) {
			console.error('Could not write ips to ' + BLOCKED_IPS_LOG + ' because of: ' + err)
		}
	}

	async block(ip) {
		const date = new Date().toLocaleString('en-NL');
		if (!this.add(ip)) return;
		if (this.get(ip).blocked == null) return;
		this.iplist[ip].blocked = true;
		this.iplist[ip].date = date;
		console.log('Blocked ' + ip + ' on ' + date);
		this.saveToDisk();
	}

	isBlocked(ip) {
		return this.get(ip)?.blocked || false;
	}

	get(ip) {
		return ip in this.iplist? this.iplist[ip] : null;
	}

	addInfraction(ip, link) {
		if (!this.add(ip)) return;
		if (this.get(ip).blocked == null) return;
		const date = new Date().toLocaleString('en-NL');
		const list = this.iplist[ip].infractions;
		list.push([date, link]);
		if (list.length > MAX_INFRACTIONS) list.splice(0, list.length - MAX_INFRACTIONS);
		console.log('Added infraction for ' + ip + ' on ' + link);
		if (list.length >= LIMIT_UNAUTH) {
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
		blacklist = new Blacklist({});
		console.error(`Couldn't load blocked ips because: ${err}`)
	}
})()

function applySecurityHeaders(response) {
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'no-referrer');
	// Microphone for the assistant's voice input, this origin only
	response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(self), camera=()');
	// Both ways in are HTTPS only (Cloudflare, Tailscale serve). Over plain
	// http (the dev server) browsers ignore it. The Content-Security-Policy
	// comes from the csp option of sveltekit() in vite.config.js, with a nonce
	// for SvelteKit's own inline script.
	response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
	return response;
}

// Paint the viewer's theme on the very first frame: the `theme` cookie
// (set by the app when a member picks a palette) becomes inline colours on
// <html>. Only known palette ids are honoured, so nothing user-controlled
// is ever written into the page.
function themed(event) {
	const theme = THEMES.find((t) => t.id === event.cookies.get('theme'));
	if (!theme) return undefined;
	return {
		transformPageChunk: ({ html }) =>
			html
				.replace('<html lang="en">', `<html lang="en" data-theme="${theme.id}" style="${themeStyle(theme)}">`)
				.replace('<meta name="theme-color" content="#FFEAD0" />', `<meta name="theme-color" content="${theme.paper}" />`)
	};
}

export async function handle({ event, resolve }) {
	if (blacklist === null) {
		console.error('Blacklist is not initialized')
		return new Response("Initializing", {status: 500, headers: {'Connection': 'close'},});
	}

	const token = event.cookies.get('session');

	const ip = clientIp(event.request.headers, () => event.getClientAddress());

	if (blacklist.isBlocked(ip)) {
		return new Response("Contact the administrator", {status: 418, headers: {'Connection': 'close'},})
	}

	// The live event stream retries on its own after a session expires: answer
	// it with a plain 401 instead of an infraction + redirect, or an idle tab
	// would get the whole IP blacklisted.
	const isEventStream = event.url.pathname === '/api/assistantEvents';

	if (!token && isEventStream) {
		return new Response(null, { status: 401 });
	}

	if (!token && event.url.pathname != '/login' && event.url.pathname != '/api/login') {
		console.log('Unauthorized connection on: ', event.url.pathname)
		if (event.url.pathname != '/') {
			blacklist.addInfraction(ip, event.url.pathname);
		}
		// Relative redirect: the dev server sees plain http, so an absolute
		// URL built from event.url.origin would downgrade the scheme.
		redirect(302, '/login');
	} else if (!token) {
		return applySecurityHeaders(await resolve(event, themed(event)));
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
		if (isEventStream) return new Response(null, { status: 401 });
		throw redirect(302, '/login');
	}

	return applySecurityHeaders(await resolve(event, themed(event)));
}
