import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';

process.env.SECRET ||= 'x'.repeat(32);
const { conversationStore, INTERRUPTED_TEXT } = await import('../assistantConversations.js');

const uri = process.env.MONGO_TEST_URI;
const skip = !uri;
let client;
let n = 0;
const me = { session: 's1', user: 'u1' };
const other = { session: 's1', user: 'u2' };

async function fresh() {
	client ??= await MongoClient.connect(uri);
	return conversationStore(client.db(`assistant_test_conv_${process.pid}_${++n}`));
}
after(async () => {
	if (!client) return;
	const { databases } = await client.db().admin().listDatabases();
	for (const d of databases) if (d.name.startsWith(`assistant_test_conv_${process.pid}_`)) await client.db(d.name).dropDatabase();
	await client.close();
});

test('startTurn creates a conversation and a queued reply after the question', { skip }, async () => {
	const s = await fresh();
	const t = await s.startTurn({ ...me, conversationId: null, text: 'hello there' });
	assert.equal(t.conversation.title, 'hello there');
	const thread = await s.thread(t.conversation._id);
	assert.deepEqual(thread.map(m => m.role), ['user', 'assistant']);
	assert.equal(thread[1].status, 'queued');
});

test("another member's conversation is invisible", { skip }, async () => {
	const s = await fresh();
	const t = await s.startTurn({ ...me, conversationId: null, text: 'mine' });
	assert.equal(await s.startTurn({ ...other, conversationId: t.conversation._id, text: 'x' }), null);
	assert.equal(await s.get(other, t.conversation._id), null);
	assert.equal(await s.getMessage(other, t.reply._id), null);
	assert.equal(await s.remove(other, t.conversation._id), 'missing');
	assert.equal((await s.list(other)).conversations.length, 0);
});

test('list shows busy and unread; markRead clears unread', { skip }, async () => {
	const s = await fresh();
	const t = await s.startTurn({ ...me, conversationId: null, text: 'q' });
	let l = await s.list(me);
	assert.equal(l.conversations[0].busy, true);
	await s.finishReply(t.conversation._id, t.reply._id, { status: 'done', content: 'a' });
	l = await s.list(me);
	assert.equal(l.conversations[0].busy, false);
	assert.equal(l.conversations[0].unread, true);
	assert.equal(l.unreadCount, 1);
	await s.markRead(me, t.conversation._id);
	assert.equal(await s.unreadCount(me), 0);
});

test('a member-cancelled reply does not mark the conversation unread', { skip }, async () => {
	const s = await fresh();
	const t = await s.startTurn({ ...me, conversationId: null, text: 'q' });
	await s.finishReply(t.conversation._id, t.reply._id, { status: 'cancelled' }, new Date(), { unread: false });
	assert.equal(await s.unreadCount(me), 0);
});

test('plans: claim once, second claim and claim after reject get null', { skip }, async () => {
	const s = await fresh();
	const t = await s.startTurn({ ...me, conversationId: null, text: 'q' });
	const plan = { state: 'review', results: [], actions: [{ ref: '#1', tool: 'add_todo', summary: 'Add', path: '/todos', body: {} }] };
	await s.finishReply(t.conversation._id, t.reply._id, { status: 'done', plan });
	assert.equal(await s.claimPlan(other, t.reply._id), null);
	const claimed = await s.claimPlan(me, t.reply._id);
	assert.equal(claimed.plan.state, 'running');
	assert.equal(await s.claimPlan(me, t.reply._id), null);
	const settled = await s.settlePlan(t.reply._id, [{ ref: '#1', status: 'done' }]);
	assert.equal(settled.plan.state, 'finished');

	const t2 = await s.startTurn({ ...me, conversationId: t.conversation._id, text: 'q2' });
	await s.finishReply(t.conversation._id, t2.reply._id, { status: 'done', plan });
	assert.equal((await s.rejectPlan(me, t2.reply._id)).plan.state, 'rejected');
	assert.equal(await s.claimPlan(me, t2.reply._id), null);
	assert.equal(await s.rejectPlan(me, t2.reply._id), null);
});

test('remove refuses while an answer is running, then deletes everything', { skip }, async () => {
	const s = await fresh();
	const t = await s.startTurn({ ...me, conversationId: null, text: 'q' });
	await s.updateReply(t.reply._id, { status: 'running' });
	assert.equal(await s.remove(me, t.conversation._id), 'busy');
	await s.updateReply(t.reply._id, { status: 'done' });
	assert.equal(await s.remove(me, t.conversation._id), 'deleted');
	assert.equal((await s.thread(t.conversation._id)).length, 0);
});

test('markInterrupted marks the reply and the conversation unread', { skip }, async () => {
	const s = await fresh();
	const t = await s.startTurn({ ...me, conversationId: null, text: 'q' });
	await s.markInterrupted([{ conversationId: t.conversation._id, messageId: t.reply._id }]);
	const reply = await s.getMessage(me, t.reply._id);
	assert.equal(reply.status, 'interrupted');
	assert.equal(reply.error, INTERRUPTED_TEXT);
	assert.equal(await s.unreadCount(me), 1);
});

test('unknown ids are simply not found', { skip }, async () => {
	const s = await fresh();
	assert.equal(await s.get(me, new ObjectId()), null);
});
