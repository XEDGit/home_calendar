// Dependency-free security middleware: response hardening headers, a global
// NoSQL operator-injection scrubber, and an in-memory login rate limiter.
// Kept dependency-free so it hot-reloads in the container without a rebuild.

// Strip keys that MongoDB would treat as query/update operators ($-prefixed)
// or dotted paths, recursively, from any client-supplied object.
function scrub(value) {
	if (Array.isArray(value)) {
		for (const item of value) scrub(item);
		return value;
	}
	if (value && typeof value === 'object') {
		for (const key of Object.keys(value)) {
			if (key.startsWith('$') || key.includes('.')) {
				delete value[key];
			} else {
				scrub(value[key]);
			}
		}
	}
	return value;
}

export function mongoSanitize(req, _res, next) {
	if (req.body) scrub(req.body);
	if (req.query) scrub(req.query);
	if (req.params) scrub(req.params);
	next();
}

export function securityHeaders(_req, res, next) {
	res.removeHeader('X-Powered-By');
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('Referrer-Policy', 'no-referrer');
	res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
	res.setHeader('Cache-Control', 'no-store');
	next();
}

// Sliding-window limiter keyed by username (falls back to source address).
// Backend sees the frontend proxy address for every request, so keying on the
// targeted username is what actually throttles credential stuffing here.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

setInterval(() => {
	const cutoff = Date.now() - WINDOW_MS;
	for (const [key, times] of attempts) {
		const kept = times.filter((t) => t > cutoff);
		if (kept.length === 0) attempts.delete(key);
		else attempts.set(key, kept);
	}
}, WINDOW_MS).unref?.();

function limiterKey(req) {
	const username = (req.body && typeof req.body.username === 'string') ? req.body.username.slice(0, 256) : '';
	return `${req.ip}|${username}`;
}

// Successful logins should not count toward the limit.
export function resetLoginAttempts(req) {
	attempts.delete(limiterKey(req));
}

export function loginRateLimiter(req, res, next) {
	const key = limiterKey(req);
	const now = Date.now();
	const cutoff = now - WINDOW_MS;
	const times = (attempts.get(key) || []).filter((t) => t > cutoff);
	if (times.length >= MAX_ATTEMPTS) {
		res.setHeader('Retry-After', String(Math.ceil(WINDOW_MS / 1000)));
		return res.status(429).send({ error: 'Too many attempts. Try again later.' });
	}
	times.push(now);
	attempts.set(key, times);
	next();
}
