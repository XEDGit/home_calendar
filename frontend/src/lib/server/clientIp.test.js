import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clientIp } from './clientIp.js';

const h = (o) => new Headers(o);
const peer = () => '10.42.0.1';

test('through the Cloudflare tunnel: the visitor is CF-Connecting-IP', () => {
	assert.equal(clientIp(h({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '203.0.113.7, 10.42.0.9' }), peer), '203.0.113.7');
	assert.equal(clientIp(h({ 'cf-connecting-ip': ' 2001:db8::1 ' }), peer), '2001:db8::1');
});

test('nginx in front: its X-Real-IP', () => {
	assert.equal(clientIp(h({ 'x-real-ip': '198.51.100.4', 'x-forwarded-for': '1.1.1.1, 198.51.100.4' }), peer), '198.51.100.4');
});

test('Tailscale serve: the last X-Forwarded-For hop, never the client-written ones before it', () => {
	assert.equal(clientIp(h({ 'x-forwarded-for': '6.6.6.6, 100.80.132.84' }), peer), '100.80.132.84');
	assert.equal(clientIp(h({ 'x-forwarded-for': '100.80.132.84' }), peer), '100.80.132.84');
});

test('no proxy headers: the socket peer, or unknown', () => {
	assert.equal(clientIp(h({}), peer), '10.42.0.1');
	assert.equal(clientIp(h({ 'x-forwarded-for': ' , ' }), peer), '10.42.0.1');
	assert.equal(clientIp(h({}), () => { throw new Error('no peer'); }), 'unknown');
});
