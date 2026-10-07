import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publish, subscribe, listenerTotal } from '../assistantEvents.js';

test('events reach only the matching member', () => {
	const got = [];
	const off = subscribe('s1', 'u1', (e) => got.push(e));
	publish('s1', 'u1', { type: 'a' });
	publish('s1', 'u2', { type: 'b' });
	publish('s2', 'u1', { type: 'c' });
	off();
	assert.deepEqual(got, [{ type: 'a' }]);
});

test('unsubscribe removes the listener', () => {
	const before = listenerTotal();
	const off = subscribe('s1', 'u9', () => {});
	assert.equal(listenerTotal(), before + 1);
	off();
	assert.equal(listenerTotal(), before);
});
