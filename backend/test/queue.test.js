import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, PRIORITY } from '../assistantQueue.js';
import { memoryJobStore } from './helpers/memoryJobStore.js';

const quiet = { error() {} };
const chat = (n, extra = {}) => ({ kind: 'chat', session: 's1', user: 'u1', conversationId: `c${n}`, messageId: `m${n}`, ...extra });
const auto = (n) => ({ kind: 'automation', session: 's1', user: 'u1', automationId: `a${n}` });
function gate() { let open; const p = new Promise(r => { open = r; }); return { p, open }; }

// Store that parks the worker right after its first claim: announce() waits in
// listQueued until release(), so a cancel lands between claim and start.
function parkingStore() {
	const store = memoryJobStore();
	const g = gate();
	let armed = true;
	let holding = false;
	let onParked;
	const parked = new Promise(r => { onParked = r; });
	return {
		...store,
		parked,
		release: () => g.open(),
		async claimNext(now) {
			const job = await store.claimNext(now);
			if (job && armed) { armed = false; holding = true; onParked(); }
			return job;
		},
		async listQueued() {
			if (holding) { holding = false; await g.p; }
			return store.listQueued();
		},
	};
}

test('PRIORITY puts chat first', () => {
	assert.ok(PRIORITY.chat < PRIORITY.automation);
});

test('runs chat before automations, oldest first', async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet });
	const order = [];
	q.on('chat', async (job) => { order.push(job.messageId); });
	q.on('automation', async (job) => { order.push(job.automationId); });
	await q.enqueue(auto(1));
	await q.enqueue(chat(1));
	await q.enqueue(chat(2));
	q.start();
	await q.idle();
	assert.deepEqual(order, ['m1', 'm2', 'a1']);
});

test('a running job is never preempted', async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet });
	const order = [];
	const g = gate();
	q.on('automation', async (job) => { order.push(job.automationId); await g.p; });
	q.on('chat', async (job) => { order.push(job.messageId); });
	await q.enqueue(auto(1));
	q.start();
	await new Promise(r => setTimeout(r, 10));
	await q.enqueue(chat(1));
	g.open();
	await q.idle();
	assert.deepEqual(order, ['a1', 'm1']);
});

test('ahead counts the running job and earlier queued jobs; later chat raises automation', async () => {
	const store = memoryJobStore();
	const seen = [];
	const q = createQueue({ store, log: quiet, onPositions: (list) => seen.push(list.map(p => [p.job.messageId || p.job.automationId, p.ahead])) });
	const g = gate();
	q.on('automation', async () => { await g.p; });
	q.on('chat', async () => {});
	await q.enqueue(auto(1));
	q.start();
	await new Promise(r => setTimeout(r, 10)); // a1 running
	const a2 = await q.enqueue(auto(2));
	assert.equal(await q.ahead(a2._id), 1);
	const c1 = await q.enqueue(chat(1));
	assert.equal(await q.ahead(c1._id), 1);
	assert.equal(await q.ahead(a2._id), 2);
	assert.deepEqual(seen.at(-1), [['m1', 1], ['a2', 2]]);
	g.open();
	await q.idle();
});

test('cancel removes a queued job before it runs', async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet });
	let ran = false;
	q.on('chat', async () => { ran = true; });
	const job = await q.enqueue(chat(1));
	assert.equal(await q.cancel(job._id), 'cancelled');
	q.start();
	await q.idle();
	assert.equal(ran, false);
	assert.equal((await store.get(job._id)).status, 'cancelled');
	assert.equal(await q.cancel(job._id), 'finished');
	assert.equal(await q.cancel('nope'), 'missing');
});

test('cancel stops a running job through its signal', async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet });
	let reason = null;
	q.on('chat', (job, { signal }) => new Promise((resolve) => {
		signal.addEventListener('abort', () => { reason = signal.reason; resolve(); });
	}));
	const job = await q.enqueue(chat(1));
	q.start();
	await new Promise(r => setTimeout(r, 10));
	assert.equal(await q.cancel(job._id), 'stopping');
	await q.idle();
	assert.equal(reason, 'cancelled');
	assert.equal((await store.get(job._id)).status, 'cancelled');
});

test('a job that runs too long is aborted with reason timeout and marked error', async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet, timeoutMs: 20 });
	let reason = null;
	q.on('chat', (job, { signal }) => new Promise((resolve, reject) => {
		signal.addEventListener('abort', () => { reason = signal.reason; reject(new Error('aborted')); });
	}));
	const job = await q.enqueue(chat(1));
	q.start();
	await q.idle();
	assert.equal(reason, 'timeout');
	assert.equal((await store.get(job._id)).status, 'error');
});

test('a handler that throws marks its job error and the next job still runs', async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet });
	const ran = [];
	q.on('chat', async (job) => { ran.push(job.messageId); if (job.messageId === 'm1') throw new Error('boom'); });
	const j1 = await q.enqueue(chat(1));
	const j2 = await q.enqueue(chat(2));
	q.start();
	await q.idle();
	assert.deepEqual(ran, ['m1', 'm2']);
	assert.equal((await store.get(j1._id)).status, 'error');
	assert.equal((await store.get(j2._id)).status, 'done');
});

test('enqueue while idle wakes the worker', async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet });
	const ran = [];
	q.on('chat', async (job) => { ran.push(job.messageId); });
	q.start();
	await q.idle();
	await q.enqueue(chat(1));
	await new Promise(r => setTimeout(r, 10));
	await q.idle();
	assert.deepEqual(ran, ['m1']);
});

test('recover requeues automations and returns interrupted chats', async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet });
	await store.insert({ kind: 'automation', priority: 1, status: 'running', createdAt: new Date(), automationId: 'a1' });
	await store.insert({ kind: 'chat', priority: 0, status: 'running', createdAt: new Date(), messageId: 'm1' });
	const { requeued, interrupted } = await q.recover();
	assert.equal(requeued, 1);
	assert.deepEqual(interrupted.map(j => j.messageId), ['m1']);
});

test('a job cancelled between claim and start never calls its handler', async () => {
	const store = parkingStore();
	const q = createQueue({ store, log: quiet });
	const ran = [];
	q.on('chat', async (job) => { ran.push(job.messageId); });
	const first = await q.enqueue(chat(1));
	const second = await q.enqueue(chat(2));
	q.start();
	await store.parked; // first is claimed; the worker is parked before it starts
	assert.equal(await q.cancel(first._id), 'stopping');
	store.release();
	await q.idle();
	assert.deepEqual(ran, ['m2']);
	assert.equal((await store.get(first._id)).status, 'cancelled');
	assert.equal((await store.get(second._id)).status, 'done');
});

test('a handler that ignores abort is abandoned after the grace period and the next job runs', { timeout: 2000 }, async () => {
	const store = memoryJobStore();
	const q = createQueue({ store, log: quiet, timeoutMs: 20, graceMs: 20 });
	const ran = [];
	q.on('chat', (job) => {
		if (job.messageId === 'm1') return new Promise(() => {}); // never settles, ignores its signal
		ran.push(job.messageId);
	});
	const j1 = await q.enqueue(chat(1));
	const j2 = await q.enqueue(chat(2));
	q.start();
	await q.idle();
	assert.deepEqual(ran, ['m2']);
	assert.equal((await store.get(j1._id)).status, 'error');
	assert.equal((await store.get(j2._id)).status, 'done');
});

test('unknown job kinds are rejected at enqueue', async () => {
	const q = createQueue({ store: memoryJobStore(), log: quiet });
	await assert.rejects(() => q.enqueue({ kind: 'other' }), /unknown job kind/);
});
