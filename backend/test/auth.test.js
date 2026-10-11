import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookies from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

process.env.SECRET ||= 'x'.repeat(32);
const { default: db } = await import('../db.js');
const { default: authRouter } = await import('../auth.js');

// One household in memory instead of the sessions collection
let household;
db.findVerify = async (session) => (household && session === household.session ? [household] : []);
db.setSessionPassword = async (session, password, changedAt) => {
	if (session !== household.session) return false;
	Object.assign(household, { password, passwordChangedAt: changedAt });
	return true;
};

let server, base;
before(async () => {
	const app = express();
	app.use(express.json());
	app.use(cookies());
	app.use('/', authRouter);
	server = app.listen(0);
	await new Promise((r) => server.once('listening', r));
	base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

let n = 0;
beforeEach(() => {
	// A fresh household each test, so the per-household limiter starts empty
	household = { session: `s${++n}`, username: 'house', password: bcrypt.hashSync('old-password', 4) };
});

// A login issued a minute ago, like any device that's been logged in a while
const loginFor = (session) => jwt.sign({ session, iat: Math.floor(Date.now() / 1000) - 60 }, process.env.SECRET, { expiresIn: '30d' });

function post(path, body, token) {
	return fetch(base + path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: `session=${token}` } : {}) },
		body: JSON.stringify(body),
	});
}
const verify = (token) => post('/verify', { token }).then((r) => r.status);
const sessionCookie = (res) => res.headers.getSetCookie().find((c) => c.startsWith('session='));

test('changing the password signs out older logins and keeps this browser logged in', async () => {
	const old = loginFor(household.session);
	const elsewhere = loginFor(household.session);
	assert.equal(await verify(old), 200);

	const res = await post('/password', { current: 'old-password', password: 'new-password' }, old);
	assert.equal(res.status, 200);
	assert.ok(bcrypt.compareSync('new-password', household.password), 'the new hash is stored');

	const fresh = sessionCookie(res).split(';')[0].slice('session='.length);
	assert.match(sessionCookie(res), /HttpOnly/i);
	assert.equal(await verify(fresh), 200, 'this browser stays logged in');
	assert.equal(await verify(old), 401, 'the login it replaced no longer counts');
	assert.equal(await verify(elsewhere), 401, 'other devices have to log in again');
});

test('a wrong current password changes nothing', async () => {
	const token = loginFor(household.session);
	const stored = household.password;
	const res = await post('/password', { current: 'guess', password: 'new-password' }, token);
	assert.equal(res.status, 403);
	assert.deepEqual(await res.json(), { error: 'The current password is wrong', field: 'current' });
	assert.equal(household.password, stored);
	assert.equal(household.passwordChangedAt, undefined);
	assert.equal(await verify(token), 200);
});

test('a too-short new password is refused with the field it belongs to', async () => {
	const res = await post('/password', { current: 'old-password', password: 'short' }, loginFor(household.session));
	assert.equal(res.status, 400);
	assert.equal((await res.json()).field, 'password');
});

test('a missing or non-string current password is refused like a wrong one', async () => {
	const token = loginFor(household.session);
	assert.equal((await post('/password', { password: 'new-password' }, token)).status, 403);
	assert.equal((await post('/password', { current: { $ne: null }, password: 'new-password' }, token)).status, 403);
});

test('without a login there is nothing to change', async () => {
	assert.equal((await post('/password', { current: 'old-password', password: 'new-password' })).status, 401);
	assert.equal((await post('/password', { current: 'old-password', password: 'new-password' }, 'not-a-jwt')).status, 401);
});

test('guessing the current password is throttled per household', async () => {
	const token = loginFor(household.session);
	const statuses = [];
	for (let i = 0; i < 11; i++) statuses.push((await post('/password', { current: `guess-${i}`, password: 'new-password' }, token)).status);
	assert.deepEqual(statuses, [...Array(10).fill(403), 429]);
	// Another household isn't held back by it
	household = { session: 'other', username: 'other', password: bcrypt.hashSync('old-password', 4) };
	assert.equal((await post('/password', { current: 'guess', password: 'new-password' }, loginFor('other'))).status, 403);
});

test('logout clears the session cookie', async () => {
	const res = await post('/logout', {}, loginFor(household.session));
	assert.equal(res.status, 200);
	const cookie = sessionCookie(res);
	assert.match(cookie, /^session=;/);
	assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
	assert.match(cookie, /Path=\//);
	assert.doesNotMatch(cookie, /Max-Age/i);
});
