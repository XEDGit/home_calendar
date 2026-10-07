import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { jobStoreContract } from './helpers/jobStoreContract.js';

// Runs against a throwaway Mongo only: MONGO_TEST_URI=mongodb://127.0.0.1:27099/assistant_test
const uri = process.env.MONGO_TEST_URI;
const skip = !uri;
let client;
let n = 0;

async function freshDb() {
	client ??= await MongoClient.connect(uri);
	return client.db(`assistant_test_jobs_${process.pid}_${++n}`);
}

after(async () => {
	if (!client) return;
	const { databases } = await client.db().admin().listDatabases();
	for (const d of databases) if (d.name.startsWith(`assistant_test_jobs_${process.pid}_`)) await client.db(d.name).dropDatabase();
	await client.close();
});

const { mongoJobStore, ensureAssistantIndexes } = await import('../assistantJobs.js');

jobStoreContract('mongo store', {
	skip,
	makeId: () => new ObjectId(),
	makeStore: async () => mongoJobStore((await freshDb()).collection('assistant_jobs')),
});

test('ensureAssistantIndexes creates the queue, TTL and message indexes', { skip }, async () => {
	const db = await freshDb();
	await ensureAssistantIndexes(db);
	await ensureAssistantIndexes(db); // idempotent
	const jobs = await db.collection('assistant_jobs').indexes();
	const ttl = jobs.find(i => i.key.finishedAt === 1);
	assert.equal(ttl.expireAfterSeconds, 604800);
	assert.ok(jobs.some(i => i.key.status === 1 && i.key.priority === 1 && i.key.createdAt === 1));
	const messages = await db.collection('assistant_messages').indexes();
	assert.ok(messages.some(i => i.key.conversationId === 1 && i.key.createdAt === 1));
	const conversations = await db.collection('assistant_conversations').indexes();
	assert.ok(conversations.some(i => i.key.session === 1 && i.key.user === 1 && i.key.updatedAt === -1));
});
