import { historyFromMessages, clientPlan } from './assistantConversations.js';

// Runs one queued chat question: rebuilds the conversation for the model,
// streams the answer to the member's open pages, and stores the result
// (answer, tool steps, staged plan, writes already done) on the reply.

export const UNAVAILABLE_TEXT = 'The assistant is unavailable right now';
export const TIMEOUT_TEXT = 'Took too long, try again';
export const MEMBER_GONE_TEXT = 'Member no longer exists';

export function createChatJobHandler({
	conversations, publish, loadMember, mintCookie, createExecutor, householdContext,
	systemPrompt, userTurn, runAgent, saveEveryMs = 1000, maxHistory = 20, maxMessage = 2000, log = console,
}) {
	return async function chatJob(job, { signal }) {
		const { session, user, conversationId, messageId } = job;
		const ids = { conversationId: String(conversationId), messageId: String(messageId) };
		// Publishing is best effort: a broken listener must not undo or fail the run
		const send = (...args) => {
			try { publish(...args); }
			catch (err) { log.error('Assistant event publish failed:', err); }
		};
		const emit = (event) => send(session, user, { ...ids, ...event });
		const publishUnread = async () => {
			try { send(session, user, { type: 'unread', count: await conversations.unreadCount({ session, user }) }); }
			catch (err) { log.error('Assistant unread count failed:', err); }
		};

		const reply = { content: '', tools: [] };
		let exec = null;
		let thread = [];
		let q = -1;
		// Progress saves are chained so a slow one can never land after the final write
		let saving = Promise.resolve();
		let lastSave = 0;
		const save = () => {
			if (Date.now() - lastSave < saveEveryMs) return;
			lastSave = Date.now();
			const snapshot = { content: reply.content, tools: [...reply.tools] };
			saving = saving.then(() => conversations.updateReply(messageId, snapshot))
				.catch(err => log.error('Assistant progress save failed:', err));
		};
		const doneActions = () => (exec?.done?.length ? exec.done.map(a => ({ ref: a.ref, tool: a.tool, summary: a.summary })) : null);

		let failed = false;
		let failure = null;
		try {
			thread = await conversations.thread(conversationId);
			const at = thread.findIndex(m => String(m._id) === String(messageId));
			if (at < 0) return; // conversation deleted while queued
			q = at - 1;
			while (q >= 0 && thread[q].role !== 'user') q--;
			if (signal.aborted) {
				// Cancelled while still queued: nothing to run, no member lookup, no model call
				await conversations.finishReply(conversationId, messageId, { status: 'cancelled' }, new Date(), { unread: false });
				emit({ type: 'end', status: 'cancelled' });
				await publishUnread();
				return;
			}
			await conversations.updateReply(messageId, { status: 'running' });
			emit({ type: 'start' });
			const member = await loadMember(session, user);
			if (!member) throw Object.assign(new Error(MEMBER_GONE_TEXT), { userFacing: true });
			exec = createExecutor({ cookie: mintCookie(session, user), userId: user, stage: member.assistantConfirm !== false });
			const messages = [
				{ role: 'system', content: systemPrompt(member, await householdContext(exec)) },
				...historyFromMessages(thread.slice(0, Math.max(q, 0)), { maxHistory, maxMessage }),
				{ role: 'user', content: userTurn(q >= 0 ? thread[q].content : '') },
			];
			await runAgent({
				messages, exec, signal,
				onText: (text) => { reply.content += text; emit({ type: 'text', text }); save(); },
				onTool: (name, result) => {
					const tool = { name, summary: result.summary ?? null, error: result.error ?? null, staged: !!result.staged, done: !!result.done };
					reply.tools.push(tool);
					emit({ type: 'tool', ...tool });
					save();
				},
			});

			const plan = exec.staged.length ? { state: 'review', actions: exec.staged, results: [] } : null;
			const fields = { content: reply.content.trim(), tools: reply.tools, plan, doneActions: doneActions(), status: 'done', error: null };
			if (signal.aborted) {
				fields.status = signal.reason === 'cancelled' ? 'cancelled' : 'error';
				fields.error = fields.status === 'error' ? TIMEOUT_TEXT : null;
			}
			await saving;
			await conversations.finishReply(conversationId, messageId, fields, new Date(), { unread: fields.status !== 'cancelled' });
			if (plan) emit({ type: 'plan', plan: clientPlan(plan) });
			if (fields.doneActions) emit({ type: 'done_actions', actions: fields.doneActions });
			if (fields.error) emit({ type: 'error', error: fields.error });
			emit({ type: 'end', status: fields.status });
		} catch (err) {
			const reason = signal.aborted ? signal.reason : null;
			const status = reason === 'cancelled' ? 'cancelled' : 'error';
			const error = status === 'cancelled' ? null : reason === 'timeout' ? TIMEOUT_TEXT : err?.userFacing ? err.message : UNAVAILABLE_TEXT;
			if (status === 'error') { failed = true; failure = err ?? new Error('Assistant chat job failed'); }
			await saving;
			// Staged changes from a broken run are dropped; writes that already ran are kept on record
			await conversations.finishReply(conversationId, messageId,
				{ content: reply.content.trim(), tools: reply.tools, doneActions: doneActions(), status, error },
				new Date(), { unread: status !== 'cancelled' })
				.catch(e => log.error('Assistant reply could not be saved:', e));
			const actions = doneActions();
			if (actions) emit({ type: 'done_actions', actions });
			if (error) emit({ type: 'error', error });
			emit({ type: 'end', status });
		}
		await publishUnread();
		if (failed) throw failure;
	};
}
