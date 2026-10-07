// In-memory job store with the same contract as assistantJobs.js's Mongo
// store, for queue tests. Ids are strings; callers compare with String().
const ACTIVE = new Set(['queued', 'running']);

export function memoryJobStore() {
	const jobs = [];
	let seq = 0;
	const order = (a, b) => a.priority - b.priority || a.createdAt - b.createdAt || a.seq - b.seq;
	const copy = (j) => (j ? { ...j } : null);
	const byId = (id) => jobs.find(j => j._id === String(id));

	return {
		jobs,
		async insert(job) {
			const j = { ...job, _id: `job${++seq}`, seq };
			jobs.push(j);
			return copy(j);
		},
		async claimNext(now) {
			const next = jobs.filter(j => j.status === 'queued').sort(order)[0];
			if (!next) return null;
			next.status = 'running';
			next.startedAt = now;
			return copy(next);
		},
		async finish(id, status, now) {
			const j = byId(id);
			if (j) { j.status = status; j.finishedAt = now; }
		},
		async cancelQueued(id, now) {
			const j = byId(id);
			if (!j || j.status !== 'queued') return false;
			j.status = 'cancelled';
			j.finishedAt = now;
			return true;
		},
		async get(id) { return copy(byId(id)); },
		async listQueued() { return jobs.filter(j => j.status === 'queued').sort(order).map(copy); },
		async countRunning() { return jobs.filter(j => j.status === 'running').length; },
		async countActive({ session, user, kind }) {
			return jobs.filter(j => ACTIVE.has(j.status) && j.session === session && j.user === user && j.kind === kind).length;
		},
		async activeByMessage(messageId) {
			return copy(jobs.find(j => ACTIVE.has(j.status) && String(j.messageId) === String(messageId)));
		},
		async activeByConversation(conversationId) {
			return jobs.filter(j => ACTIVE.has(j.status) && String(j.conversationId) === String(conversationId)).map(copy);
		},
		async hasActiveAutomation(automationId) {
			return jobs.some(j => j.kind === 'automation' && ACTIVE.has(j.status) && String(j.automationId) === String(automationId));
		},
		async resetRunning(now) {
			let requeued = 0;
			const interrupted = [];
			for (const j of jobs) {
				if (j.status !== 'running') continue;
				if (j.kind === 'automation') { j.status = 'queued'; j.startedAt = null; requeued++; }
				else { j.status = 'interrupted'; j.finishedAt = now; interrupted.push(copy(j)); }
			}
			return { requeued, interrupted };
		},
	};
}
