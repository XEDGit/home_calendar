import { test } from 'node:test';
import assert from 'node:assert/strict';

// Behaviour every job store must have. `makeStore()` returns a fresh, empty
// store (may be async); `makeId()` returns an id of the store's id type.
export function jobStoreContract(label, { makeStore, makeId, skip = false }) {
	const t0 = new Date('2026-10-08T10:00:00Z');
	const at = (ms) => new Date(t0.getTime() + ms);
	const job = (fields) => ({ status: 'queued', startedAt: null, finishedAt: null, ...fields });
	const chat = (ms, extra = {}) => job({ kind: 'chat', priority: 0, session: 's1', user: 'u1', createdAt: at(ms), conversationId: makeId(), messageId: makeId(), ...extra });
	const auto = (ms, extra = {}) => job({ kind: 'automation', priority: 1, session: 's1', user: 'u1', createdAt: at(ms), automationId: makeId(), ...extra });

	test(`${label}: claims chat before automation, then oldest first`, { skip }, async () => {
		const store = await makeStore();
		await store.insert(auto(0));
		const c2 = await store.insert(chat(20));
		const c1 = await store.insert(chat(10));
		assert.equal(String((await store.claimNext(at(100)))._id), String(c1._id));
		assert.equal(String((await store.claimNext(at(100)))._id), String(c2._id));
		assert.equal((await store.claimNext(at(100))).kind, 'automation');
		assert.equal(await store.claimNext(at(100)), null);
	});

	test(`${label}: a job is claimed only once`, { skip }, async () => {
		const store = await makeStore();
		await store.insert(chat(0));
		const [a, b] = await Promise.all([store.claimNext(at(1)), store.claimNext(at(1))]);
		assert.equal([a, b].filter(Boolean).length, 1);
	});

	test(`${label}: counts and lookups only see queued and running jobs`, { skip }, async () => {
		const store = await makeStore();
		const conversationId = makeId();
		const q = await store.insert(chat(0, { conversationId }));
		await store.insert(chat(1, { conversationId }));
		const done = await store.insert(chat(2, { conversationId }));
		await store.claimNext(at(3)); // q is running now
		await store.finish((await store.claimNext(at(4)))._id, 'done', at(5)); // second finishes
		assert.equal(await store.countActive({ session: 's1', user: 'u1', kind: 'chat' }), 2); // q running + done still queued
		assert.equal(await store.countActive({ session: 's1', user: 'u2', kind: 'chat' }), 0);
		assert.equal(await store.countRunning(), 1);
		assert.equal(String((await store.activeByMessage(q.messageId))._id), String(q._id));
		assert.equal((await store.activeByConversation(conversationId)).length, 2);
		assert.equal(String((await store.listQueued())[0]._id), String(done._id));
	});

	test(`${label}: cancelQueued only cancels queued jobs`, { skip }, async () => {
		const store = await makeStore();
		const a = await store.insert(chat(0));
		const b = await store.insert(chat(1));
		await store.claimNext(at(2)); // a running
		assert.equal(await store.cancelQueued(a._id, at(3)), false);
		assert.equal(await store.cancelQueued(b._id, at(3)), true);
		assert.equal((await store.get(b._id)).status, 'cancelled');
		assert.equal(await store.cancelQueued(b._id, at(4)), false);
	});

	test(`${label}: resetRunning requeues automations and interrupts chats`, { skip }, async () => {
		const store = await makeStore();
		const a = await store.insert(auto(0));
		const c = await store.insert(chat(1));
		await store.claimNext(at(2));
		await store.claimNext(at(2));
		const { requeued, interrupted } = await store.resetRunning(at(3));
		assert.equal(requeued, 1);
		assert.deepEqual(interrupted.map(j => String(j._id)), [String(c._id)]);
		assert.equal((await store.get(a._id)).status, 'queued');
		assert.equal((await store.get(a._id)).startedAt, null);
		assert.equal((await store.get(c._id)).status, 'interrupted');
		assert.equal(await store.hasActiveAutomation(a.automationId), true);
	});
}
