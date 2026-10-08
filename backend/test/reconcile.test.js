import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SECRET ||= 'x'.repeat(32);
const { reconcileOnStartup } = await import('../assistantReconcile.js');
const { INTERRUPTED_TEXT } = await import('../assistantConversations.js');

test('reconcileOnStartup interrupts running plans and replies without a job', async () => {
	const calls = { plans: [], finished: [] };
	const conversations = {
		runningPlans: async () => [{ _id: 'p1' }, { _id: 'p2' }],
		interruptPlan: async (id) => calls.plans.push(id),
		activeReplies: async () => [
			{ _id: 'orphan', conversationId: 'c1' },
			{ _id: 'live', conversationId: 'c2' },
		],
		finishReply: async (...args) => calls.finished.push(args),
	};
	const queue = { activeByMessage: async (id) => (id === 'live' ? { _id: 'j' } : null) };
	const now = new Date();
	const counts = await reconcileOnStartup({ conversations, queue, now });
	assert.deepEqual(calls.plans, ['p1', 'p2']);
	assert.deepEqual(calls.finished, [['c1', 'orphan', { status: 'interrupted', error: INTERRUPTED_TEXT }, now]]);
	assert.deepEqual(counts, { plans: 2, replies: 1 });
});
