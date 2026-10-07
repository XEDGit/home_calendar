import { actionDeps } from './assistantTools.js';

// Stored assistant conversations: one document per conversation, one per
// message. Private to the member who started them: every query carries the
// household `session` and the member `user`.

export const TITLE_MAX = 60;
export const INTERRUPTED_TEXT = 'Interrupted by a restart, send it again';
const ACTIVE = ['queued', 'running'];

export function titleFrom(text) {
	const flat = String(text).replace(/\s+/g, ' ').trim();
	const chars = Array.from(flat); // by code point: never splits an emoji
	return chars.length > TITLE_MAX ? chars.slice(0, TITLE_MAX - 1).join('').trimEnd() + '…' : flat;
}

// The model's view of earlier turns: questions, plus answers that finished.
export function historyFromMessages(earlier, { maxHistory = 20, maxMessage = 2000 } = {}) {
	return earlier
		.filter(m => (m.role === 'user' && typeof m.content === 'string' && m.content)
			|| (m.role === 'assistant' && m.status === 'done' && typeof m.content === 'string' && m.content.trim()))
		.slice(-maxHistory)
		.map(m => ({ role: m.role, content: m.content.slice(0, maxMessage) }));
}

// Action details (paths, bodies) never leave the server
export function clientPlan(plan) {
	return {
		state: plan.state,
		results: plan.results || [],
		actions: plan.actions.map(a => ({ ref: a.ref, tool: a.tool, summary: a.summary, deps: actionDeps(a) })),
	};
}

export function clientMessage(m) {
	return {
		_id: String(m._id),
		role: m.role,
		content: m.content || '',
		status: m.status ?? null,
		error: m.error ?? null,
		tools: m.tools || [],
		doneActions: m.doneActions ?? null,
		createdAt: m.createdAt,
		plan: m.plan ? clientPlan(m.plan) : null,
	};
}

export function clientConversation(c, busyIds) {
	return { _id: String(c._id), title: c.title, updatedAt: c.updatedAt, unread: !!c.unread, busy: busyIds.has(String(c._id)) };
}

export function conversationStore(db) {
	const convs = db.collection('assistant_conversations');
	const msgs = db.collection('assistant_messages');
	const own = ({ session, user }) => ({ session, user });

	const store = {
		// Saves a question and its (empty, queued) answer. A conversationId that
		// isn't this member's returns null.
		async startTurn({ session, user, conversationId, text, now = new Date() }) {
			let conversation;
			if (conversationId) {
				conversation = await convs.findOneAndUpdate(
					{ _id: conversationId, session, user },
					{ $set: { updatedAt: now } },
					{ returnDocument: 'after' },
				);
				if (!conversation) return null;
			} else {
				conversation = { session, user, title: titleFrom(text), createdAt: now, updatedAt: now, unread: false };
				await convs.insertOne(conversation);
			}
			const base = { session, user, conversationId: conversation._id };
			const userMessage = { ...base, role: 'user', content: text, createdAt: now, updatedAt: now };
			// One ms later so "oldest first" always puts the question first
			const reply = {
				...base, role: 'assistant', content: '', status: 'queued', error: null,
				tools: [], plan: null, doneActions: null, createdAt: new Date(now.getTime() + 1), updatedAt: now,
			};
			await msgs.insertMany([userMessage, reply]);
			return { conversation, userMessage, reply };
		},

		async list(who, limit = 100) {
			const [list, busy, unreadCount] = await Promise.all([
				convs.find(own(who)).sort({ updatedAt: -1 }).limit(limit).toArray(),
				msgs.distinct('conversationId', { ...own(who), status: { $in: ACTIVE } }),
				convs.countDocuments({ ...own(who), unread: true }),
			]);
			const busyIds = new Set(busy.map(String));
			return { conversations: list.map(c => clientConversation(c, busyIds)), unreadCount };
		},

		async get(who, id) {
			const conversation = await convs.findOne({ _id: id, ...own(who) });
			if (!conversation) return null;
			return { conversation, messages: await store.thread(id) };
		},

		async markRead(who, id) {
			await convs.updateOne({ _id: id, ...own(who) }, { $set: { unread: false } });
		},

		unreadCount(who) {
			return convs.countDocuments({ ...own(who), unread: true });
		},

		async remove(who, id) {
			const conversation = await convs.findOne({ _id: id, ...own(who) });
			if (!conversation) return 'missing';
			if (await msgs.findOne({ conversationId: id, status: 'running' })) return 'busy';
			await msgs.deleteMany({ conversationId: id });
			await convs.deleteOne({ _id: id });
			return 'deleted';
		},

		thread(conversationId) {
			return msgs.find({ conversationId }).sort({ createdAt: 1, _id: 1 }).toArray();
		},

		getMessage(who, id) {
			return msgs.findOne({ _id: id, ...own(who) });
		},

		async updateReply(messageId, fields) {
			await msgs.updateOne({ _id: messageId }, { $set: { ...fields, updatedAt: new Date() } });
		},

		async finishReply(conversationId, messageId, fields, now = new Date(), { unread = true } = {}) {
			await msgs.updateOne({ _id: messageId }, { $set: { ...fields, updatedAt: now } });
			await convs.updateOne({ _id: conversationId }, { $set: { updatedAt: now, ...(unread ? { unread: true } : {}) } });
		},

		// review → running in one step: a double click can't run a plan twice
		claimPlan(who, messageId) {
			return msgs.findOneAndUpdate(
				{ _id: messageId, ...own(who), 'plan.state': 'review' },
				{ $set: { 'plan.state': 'running' } },
				{ returnDocument: 'after' },
			);
		},

		settlePlan(messageId, results) {
			return msgs.findOneAndUpdate(
				{ _id: messageId },
				{ $set: { 'plan.state': 'finished', 'plan.results': results } },
				{ returnDocument: 'after' },
			);
		},

		rejectPlan(who, messageId) {
			return msgs.findOneAndUpdate(
				{ _id: messageId, ...own(who), 'plan.state': 'review' },
				{ $set: { 'plan.state': 'rejected' } },
				{ returnDocument: 'after' },
			);
		},

		async markInterrupted(jobs, now = new Date()) {
			for (const job of jobs) {
				await store.finishReply(job.conversationId, job.messageId, { status: 'interrupted', error: INTERRUPTED_TEXT }, now);
			}
		},
	};
	return store;
}
