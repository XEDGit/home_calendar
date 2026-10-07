import { test } from 'node:test';
import assert from 'node:assert/strict';

// assistant.js pulls in db.js, which refuses to load without a SECRET
process.env.SECRET ||= 'x'.repeat(32);
const { fitContext } = await import('../assistant.js');

const page = (n) => JSON.stringify({ text: 'p'.repeat(n) });
const round = (id, n) => [
	{ role: 'assistant', content: '', tool_calls: [{ id, type: 'function', function: { name: 'fetch_page', arguments: '{}' } }] },
	{ role: 'tool', tool_call_id: id, content: page(n) },
];

test('fitContext leaves a conversation under budget alone', () => {
	const messages = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }, ...round('a', 1000), ...round('b', 1000)];
	const before = structuredClone(messages);
	fitContext(messages, 10000);
	assert.deepEqual(messages, before);
});

test('fitContext drops the oldest tool results first and keeps the newest round', () => {
	const messages = [{ role: 'system', content: 's' }, { role: 'user', content: 'u' }, ...round('a', 4000), ...round('b', 4000), ...round('c', 4000)];
	fitContext(messages, 9000);
	const tools = messages.filter(m => m.role === 'tool').map(m => m.content.length);
	assert.ok(tools[0] < 200, 'oldest dropped');
	assert.ok(tools[1] > 4000, 'second fits once the oldest is gone');
	assert.ok(tools[2] > 4000, 'newest kept');
	assert.equal(messages.length, 8);
});

test('fitContext never drops the newest round, even over budget', () => {
	const messages = [{ role: 'user', content: 'u' }, ...round('a', 50000)];
	fitContext(messages, 1000);
	assert.ok(messages[2].content.length > 50000);
});
