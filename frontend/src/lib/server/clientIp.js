// Who is asking, for the IP blacklist in hooks.server.js. The app sits
// behind one of three proxies, each of which says who the visitor is:
//
//   Cloudflare tunnel (cloudflared): CF-Connecting-IP, set by Cloudflare's
//     edge; the tunnel is the only way in from the internet, so a visitor
//     can't put their own value there.
//   nginx (the old Docker setup): X-Real-IP, restored by its realip module.
//   Tailscale serve: appends the tailnet peer to X-Forwarded-For. Only that
//     last hop is trustworthy; anything left of it came from the client.
//
// Someone reaching the app directly on the LAN or the tailnet could write
// these headers themselves; that is household-trusted ground.

/**
 * @param {Headers} headers
 * @param {() => string} peer the socket address (event.getClientAddress)
 */
export function clientIp(headers, peer) {
	const cf = headers.get('cf-connecting-ip')?.trim();
	if (cf) return cf;
	const real = headers.get('x-real-ip')?.trim();
	if (real) return real;
	const hops = (headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
	if (hops.length) return hops[hops.length - 1];
	try {
		return peer();
	} catch {
		return 'unknown';
	}
}
