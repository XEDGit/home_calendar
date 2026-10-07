import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SECRET ||= 'x'.repeat(32);
const { titleFrom, historyFromMessages, clientMessage, clientConversation, TITLE_MAX } = await import('../assistantConversations.js');

test('titleFrom flattens whitespace and caps at 60 characters', () => {
	assert.equal(titleFrom('  what is\n on   today? '), 'what is on today?');
	const long = titleFrom('a'.repeat(100));
	assert.equal(Array.from(long).length, TITLE_MAX);
	assert.ok(long.endsWith('…'));
});

test('titleFrom never splits an emoji', () => {
	const t = titleFrom('😀'.repeat(80));
	assert.equal(Array.from(t).length, TITLE_MAX);
	assert.ok(!/[\uD800-\uDBFF]$/.test(t.slice(0, -1)));
});

test('historyFromMessages keeps user turns and finished assistant answers only', () => {
	const earlier = [
		{ role: 'user', content: 'q1' },
		{ role: 'assistant', content: 'a1', status: 'done' },
		{ role: 'user', content: 'q2' },
		{ role: 'assistant', content: 'partial', status: 'error' },
		{ role: 'assistant', content: '   ', status: 'done' },
		{ role: 'user', content: 'x'.repeat(3000) },
	];
	const h = historyFromMessages(earlier, { maxHistory: 20, maxMessage: 2000 });
	assert.deepEqual(h.map(m => m.role), ['user', 'assistant', 'user', 'user']);
	assert.equal(h[1].content, 'a1');
	assert.equal(h[3].content.length, 2000);
});

test('historyFromMessages keeps only the newest maxHistory turns', () => {
	const earlier = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `q${i}` }));
	const h = historyFromMessages(earlier, { maxHistory: 20 });
	assert.equal(h.length, 20);
	assert.equal(h[0].content, 'q10');
});

test('clientMessage strips plan actions down to ref, tool, summary and deps', () => {
	const msg = {
		_id: 'm1', session: 's', user: 'u', role: 'assistant', content: 'ok', status: 'done', createdAt: new Date(0),
		plan: { state: 'review', results: [], actions: [
			{ ref: '#1', tool: 'add_todo', summary: 'Add milk', path: '/todos', body: { title: 'Milk' } },
			{ ref: '#2', tool: 'add_todo', summary: 'Tag it', path: '/todos', body: { parent: '@ref:#1' } },
		] },
	};
	const view = clientMessage(msg);
	assert.equal(view.session, undefined);
	assert.equal(view.user, undefined);
	assert.deepEqual(Object.keys(view.plan.actions[0]).sort(), ['deps', 'ref', 'summary', 'tool']);
	assert.equal(view.plan.actions[0].path, undefined);
	assert.equal(view.plan.actions[0].body, undefined);
	assert.deepEqual(view.plan.actions[1].deps, ['#1']);
	assert.equal(view.tools.length, 0);
});

test('clientConversation marks busy from the set of active conversation ids', () => {
	const c = { _id: 'c1', title: 't', updatedAt: new Date(0), unread: true, session: 's', user: 'u' };
	assert.deepEqual(clientConversation(c, new Set(['c1'])), { _id: 'c1', title: 't', updatedAt: new Date(0), unread: true, busy: true });
	assert.equal(clientConversation(c, new Set()).busy, false);
});
