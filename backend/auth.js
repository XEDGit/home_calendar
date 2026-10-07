import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import db from './db.js';
import { loginRateLimiter, resetLoginAttempts } from './security.js';

const router = Router();
const saltRounds = 10;
const SESSION_TTL = '30d';
// Cookie/JWT lifetimes are kept in sync (~30 days).
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

// secure:true requires HTTPS. Disable only when explicitly running without TLS.
const SECURE_COOKIES = process.env.INSECURE_COOKIES !== 'true';

function cookieOptions() {
	return {
		httpOnly: true,
		secure: SECURE_COOKIES,
		sameSite: 'lax',
		path: '/',
		maxAge: COOKIE_MAX_AGE,
	};
}

function validCredentials(body) {
	return body
		&& typeof body.username === 'string' && body.username.length > 0 && body.username.length <= 256
		&& typeof body.password === 'string' && body.password.length > 0 && body.password.length <= 1024;
}

router.post('/login', loginRateLimiter, async (req, res) => {
	try {
		if (!validCredentials(req.body)) {
			return res.status(400).send({ error: 'Invalid credentials' });
		}
		const { username, password } = req.body;
		const result = await db.findLogin(username);
		// Always run a bcrypt comparison (even when the user is unknown) so the
		// response time does not reveal whether a username exists.
		const hash = (result && result.length) ? result[0].password : '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';
		const ok = bcrypt.compareSync(password, hash);
		if (!result || result.length === 0 || !ok) {
			console.log('Failed login for', username);
			return res.status(401).send({ error: 'Invalid username or password' });
		}
		const sessionToken = jwt.sign({ session: result[0].session }, process.env.SECRET, { expiresIn: SESSION_TTL });
		res.cookie('session', sessionToken, cookieOptions());
		resetLoginAttempts(req);
		console.log('Logged in', username);
		return res.status(200).send({});
	} catch (err) {
		console.error('Login error:', err);
		return res.status(500).send({ error: 'Internal server error' });
	}
});

router.post('/sessions', async (req, res) => {
	try {
		if (!validCredentials(req.body)) {
			return res.status(400).send({ error: 'Invalid credentials' });
		}
		const { username, password } = req.body;
		const existing = await db.findSessionByUsername(username);
		if (existing && existing.length > 0) {
			return res.status(409).send({ error: 'Already existing' });
		}
		const doc = {
			session: crypto.randomBytes(64).toString('hex'),
			username,
			password: bcrypt.hashSync(password, saltRounds),
		};
		const ok = await db.insertSession(doc);
		if (!ok) {
			return res.status(500).send({ error: 'Internal server error' });
		}
		return res.status(201).send({});
	} catch (err) {
		console.error('Session creation error:', err);
		return res.status(500).send({ error: 'Internal server error' });
	}
});

router.post('/verify', async (req, res) => {
	try {
		const { token } = req.body;
		if (typeof token !== 'string') {
			throw Error('session token not found in request body');
		}
		const decoded = jwt.verify(token, process.env.SECRET);
		const result = await db.findVerify(decoded.session);
		if (!result || result.length === 0) {
			throw Error('session token not found in db');
		}
		res.status(200).send({});
	} catch (err) {
		console.error('Token verification failed:', err.message);
		res.status(401).send({});
	}
});

export default router;
