import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mongoSanitize, defaultBody } from '../security.js';

let server, base;
before(async () => {
	const app = express();
	app.use(express.json());
	app.use(defaultBody);
	app.use(mongoSanitize);
	app.all('/echo', (req, res) => res.send({ body: req.body, query: req.query, again: req.query }));
	server = app.listen(0);
	await new Promise((r) => server.once('listening', r));
	base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('operator keys are stripped from the query, and stay stripped', async () => {
	const res = await fetch(`${base}/echo?%24where=1&a.b=2&ok=3`);
	const { query, again } = await res.json();
	assert.deepEqual(query, { ok: '3' });
	assert.deepEqual(again, { ok: '3' });
});

test('operator keys are stripped from a JSON body, at any depth', async () => {
	const res = await fetch(`${base}/echo`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: { $ne: null }, list: [{ 'x.y': 1, z: 2 }] }),
	});
	assert.deepEqual((await res.json()).body, { name: {}, list: [{ z: 2 }] });
});

test('a request without a JSON body still gets an empty body object', async () => {
	const res = await fetch(`${base}/echo`, { method: 'POST' });
	assert.deepEqual((await res.json()).body, {});
});
