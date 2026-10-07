// Mongo storage for the assistant job queue (see assistantQueue.js for the
// contract). Finished jobs expire after 7 days via a TTL index; the
// conversation keeps the actual result.

const ACTIVE = ['queued', 'running'];
const ORDER = { priority: 1, createdAt: 1, _id: 1 };
const JOB_TTL_SECONDS = 7 * 24 * 3600;

export function mongoJobStore(collection) {
	return {
		async insert(job) {
			const doc = { ...job };
			await collection.insertOne(doc);
			return doc;
		},
		claimNext(now) {
			return collection.findOneAndUpdate(
				{ status: 'queued' },
				{ $set: { status: 'running', startedAt: now } },
				{ sort: ORDER, returnDocument: 'after' },
			);
		},
		async finish(id, status, now) {
			await collection.updateOne({ _id: id }, { $set: { status, finishedAt: now } });
		},
		async cancelQueued(id, now) {
			const r = await collection.updateOne({ _id: id, status: 'queued' }, { $set: { status: 'cancelled', finishedAt: now } });
			return r.modifiedCount === 1;
		},
		get(id) {
			return collection.findOne({ _id: id });
		},
		listQueued() {
			return collection.find({ status: 'queued' }).sort(ORDER).toArray();
		},
		countRunning() {
			return collection.countDocuments({ status: 'running' });
		},
		countActive({ session, user, kind }) {
			return collection.countDocuments({ session, user, kind, status: { $in: ACTIVE } });
		},
		activeByMessage(messageId) {
			return collection.findOne({ messageId, status: { $in: ACTIVE } });
		},
		activeByConversation(conversationId) {
			return collection.find({ conversationId, status: { $in: ACTIVE } }).toArray();
		},
		async hasActiveAutomation(automationId) {
			return !!(await collection.findOne({ kind: 'automation', automationId, status: { $in: ACTIVE } }, { projection: { _id: 1 } }));
		},
		async resetRunning(now) {
			const interrupted = await collection.find({ status: 'running', kind: 'chat' }).toArray();
			await collection.updateMany({ status: 'running', kind: 'chat' }, { $set: { status: 'interrupted', finishedAt: now } });
			const r = await collection.updateMany({ status: 'running', kind: 'automation' }, { $set: { status: 'queued', startedAt: null } });
			return {
				requeued: r.modifiedCount,
				interrupted: interrupted.map(j => ({ ...j, status: 'interrupted', finishedAt: now })),
			};
		},
	};
}

// createIndex is idempotent: safe on every start
export async function ensureAssistantIndexes(db) {
	const jobs = db.collection('assistant_jobs');
	const messages = db.collection('assistant_messages');
	const conversations = db.collection('assistant_conversations');
	await Promise.all([
		jobs.createIndex({ status: 1, priority: 1, createdAt: 1 }),
		jobs.createIndex({ finishedAt: 1 }, { expireAfterSeconds: JOB_TTL_SECONDS }),
		jobs.createIndex({ messageId: 1 }),
		messages.createIndex({ conversationId: 1, createdAt: 1 }),
		messages.createIndex({ session: 1, user: 1, status: 1 }),
		conversations.createIndex({ session: 1, user: 1, updatedAt: -1 }),
	]);
}
