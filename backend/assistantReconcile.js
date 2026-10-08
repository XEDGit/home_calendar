import { INTERRUPTED_TEXT } from './assistantConversations.js';

// After a restart nothing that was "running" is running any more: a plan
// being applied stops where it was, and a reply that no job owns can never
// finish. Mark both so the client stops waiting.
export async function reconcileOnStartup({ conversations, queue, now = new Date() }) {
	const plans = await conversations.runningPlans();
	for (const m of plans) await conversations.interruptPlan(m._id);
	let replies = 0;
	for (const m of await conversations.activeReplies()) {
		if (await queue.activeByMessage(m._id)) continue;
		await conversations.finishReply(m.conversationId, m._id, { status: 'interrupted', error: INTERRUPTED_TEXT }, now);
		replies++;
	}
	return { plans: plans.length, replies };
}
