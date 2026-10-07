import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SECRET ||= 'x'.repeat(32);
const { createChatJobHandler, UNAVAILABLE_TEXT, TIMEOUT_TEXT, MEMBER_GONE_TEXT } = await import('../assistantChatJob.js');

function fakeConversations(thread) {
	const writes = [];
	return {
		writes,
		finished: null,
		async thread() { return thread; },
		async updateReply(id, fields) { writes.push({ id, ...fields }); },
		async finishReply(conversationId, messageId, fields, now, opts = {}) { this.finished = { conversationId, messageId, fields, unread: opts.unread ?? true }; },
		async unreadCount() { return 3; },
	};
}

const job = { _id: 'j1', kind: 'chat', session: 's1', user: 'u1', conversationId: 'c1', messageId: 'r2' };
const baseThread = () => [
	{ _id: 'q1', role: 'user', content: 'earlier question' },
	{ _id: 'r1', role: 'assistant', content: 'earlier answer', status: 'done' },
	{ _id: 'q2', role: 'user', content: 'what now?' },
	{ _id: 'r2', role: 'assistant', content: '', status: 'queued' },
];

function deps(over = {}) {
	const events = [];
	const conversations = over.conversations || fakeConversations(baseThread());
	const exec = over.exec || { staged: [], done: [] };
	return {
		events, conversations, exec,
		d: {
			conversations,
			publish: (session, user, e) => events.push(e),
			loadMember: async () => ({ _id: 'u1', name: 'Mario', assistantConfirm: true }),
			mintCookie: () => 'session=t; user=u1',
			createExecutor: () => exec,
			householdContext: async () => ({}),
			systemPrompt: () => 'SYSTEM',
			userTurn: (t) => `[now] ${t}`,
			runAgent: async ({ onText }) => { onText('Hello'); onText(' there'); return { reply: 'Hello there', finished: true }; },
			saveEveryMs: 0,
			log: { error() {} },
			...over.d,
		},
	};
}
const run = (d, signal = new AbortController().signal) => createChatJobHandler(d)(job, { signal });

test('builds history from the thread and asks the current question last', async () => {
	let seen;
	const { d } = deps({ d: { runAgent: async ({ messages }) => { seen = messages; return { reply: 'ok', finished: true }; } } });
	await run(d);
	assert.deepEqual(seen.map(m => [m.role, m.content]), [
		['system', 'SYSTEM'],
		['user', 'earlier question'],
		['assistant', 'earlier answer'],
		['user', '[now] what now?'],
	]);
});

test('stores the answer and a staged plan, marks unread and publishes events', async () => {
	const exec = { staged: [{ ref: '#1', tool: 'add_todo', summary: 'Add milk', path: '/todos', body: {} }], done: [] };
	const { d, events, conversations } = deps({ exec });
	await run(d);
	const f = conversations.finished;
	assert.equal(f.fields.status, 'done');
	assert.equal(f.fields.content, 'Hello there');
	assert.equal(f.fields.plan.state, 'review');
	assert.equal(f.fields.plan.actions[0].path, '/todos'); // full details stored server-side
	assert.equal(f.unread, true);
	const types = events.map(e => e.type);
	assert.deepEqual(types, ['start', 'text', 'text', 'plan', 'end', 'unread']);
	const planEvent = events.find(e => e.type === 'plan');
	assert.equal(planEvent.plan.actions[0].path, undefined); // client view only
	assert.equal(planEvent.messageId, 'r2');
	assert.equal(events.at(-1).count, 3);
});

test('stop keeps the partial answer as cancelled and does not mark unread', async () => {
	const ctl = new AbortController();
	const { d, conversations, events } = deps({ d: { runAgent: async ({ onText, signal }) => {
		onText('Partial');
		ctl.abort('cancelled');
		const err = new Error('aborted'); err.name = 'AbortError';
		if (signal.aborted) throw err;
		return { reply: '', finished: false };
	} } });
	await run(d, ctl.signal);
	assert.equal(conversations.finished.fields.status, 'cancelled');
	assert.equal(conversations.finished.fields.content, 'Partial');
	assert.equal(conversations.finished.unread, false);
	assert.ok(!events.some(e => e.type === 'error'));
});

test('model failure stores the unavailable message and rethrows for the queue', async () => {
	const { d, conversations, events } = deps({ d: { runAgent: async () => { throw new Error('model server returned 500'); } } });
	await assert.rejects(() => run(d), /model server returned 500/);
	assert.equal(conversations.finished.fields.status, 'error');
	assert.equal(conversations.finished.fields.error, UNAVAILABLE_TEXT);
	assert.equal(events.find(e => e.type === 'error').error, UNAVAILABLE_TEXT);
	assert.equal(events.at(-1).type, 'unread');
});

test('timeout stores the too-long message', async () => {
	const ctl = new AbortController();
	const { d, conversations } = deps({ d: { runAgent: async () => { ctl.abort('timeout'); throw new Error('aborted'); } } });
	await assert.rejects(() => run(d, ctl.signal));
	assert.equal(conversations.finished.fields.error, TIMEOUT_TEXT);
});

test('writes that already ran are recorded even when the run fails', async () => {
	const exec = { staged: [], done: [{ ref: '#1', tool: 'sign_chore', summary: 'Signed Dishes', path: '/x', body: {} }] };
	const { d, conversations } = deps({ exec, d: { runAgent: async () => { throw new Error('boom'); } } });
	await assert.rejects(() => run(d));
	assert.deepEqual(conversations.finished.fields.doneActions, [{ ref: '#1', tool: 'sign_chore', summary: 'Signed Dishes' }]);
});

test('a missing member ends the job with a clear error', async () => {
	const { d, conversations } = deps({ d: { loadMember: async () => null } });
	await assert.rejects(() => run(d));
	assert.equal(conversations.finished.fields.error, MEMBER_GONE_TEXT);
});

test('a reply that no longer exists (conversation deleted) ends quietly', async () => {
	const conversations = fakeConversations([{ _id: 'q9', role: 'user', content: 'other' }]);
	let asked = false;
	const { d, events } = deps({ conversations, d: { runAgent: async () => { asked = true; return { reply: '', finished: true }; } } });
	await run(d);
	assert.equal(asked, false);
	assert.equal(conversations.finished, null);
	assert.equal(events.length, 0);
});

test('the final write wins over a slow in-flight progress save', async () => {
	const order = [];
	const conversations = fakeConversations(baseThread());
	conversations.updateReply = async (id, fields) => {
		await new Promise(r => setTimeout(r, 30));
		order.push(['progress', fields.content]);
	};
	conversations.finishReply = async function (c, m, fields) { order.push(['final', fields.content]); this.finished = { fields }; };
	const { d } = deps({ conversations });
	await run(d);
	assert.deepEqual(order.at(-1), ['final', 'Hello there']);
	assert.ok(order.filter(([k]) => k === 'progress').length >= 1);
});
