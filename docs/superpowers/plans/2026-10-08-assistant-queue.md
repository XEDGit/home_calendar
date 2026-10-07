# Assistant Prompt Queue + Stored Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every model prompt (all members' chat + automations) goes through one durable Mongo-backed queue run by a single worker; chat conversations are stored per member, listed in a new Assistant tab, and survive closed tabs and restarts.

**Architecture:** `assistantQueue.js` (queue + worker loop, storage behind a small store interface: Mongo in production, memory in tests), `assistantJobs.js` (Mongo job store + indexes), `assistantConversations.js` (conversation/message storage + pure helpers), `assistantChatJob.js` (the chat job handler, dependencies injected), `assistantEvents.js` (in-process per-member event bus). `assistant.js` keeps the agent loop and gets the new routes; `automations.js` enqueues instead of `exclusive()`. Frontend: one client store (`lib/assistant/store.js`) with one `EventSource`, shared by the home panel and a new Assistant tab.

**Tech Stack:** Node 23 ESM, Express 4, MongoDB driver 6, `node --test`; SvelteKit (adapter-node) with Svelte 5 in legacy syntax (`export let`, `on:click`, `$:`), `svelte/store`.

**Spec:** `docs/superpowers/specs/2026-10-08-assistant-queue-design.md`

**Spec adjustments made while planning (follow these, not the spec, where they differ):**
- Delete is `POST /assistant/conversations/del { id }` (repo convention: every delete is a POST, e.g. `/automations/del`), not `DELETE`.
- `GET /assistant/conversations/:id?read=0` loads without marking read (background refreshes must not clear unread markers).
- The chat job handler lives in its own module `backend/assistantChatJob.js` (dependencies injected for tests); `assistant.js` registers it.
- After confirm/reject, the server also publishes a `plan` event so other open tabs/devices of the member update.

## Global Constraints

- Backend stays ES modules (`"type": "module"`), tests are `node --test` files in `backend/test/`, no new npm dependencies.
- Every assistant document carries `session` (household id from `db.getSession(token)`) and `user` (member id string from the `user` cookie); every route filters by both and answers **404** for anything not owned by both.
- Queue order: `{ status: 'queued' }` sorted `priority` (chat 0, automation 1), then `createdAt`, then `_id`. A running job is never preempted. Exactly one worker per process; the backend must stay at 1 replica.
- Limits: `MAX_MESSAGE = 2000` chars, `MAX_HISTORY = 20` turns, per-household rate limit 20/min (existing `rateLimited`), **5** queued+running chat jobs per member, job timeout **5 minutes** (`RUN_TIMEOUT_MS = 5 * 60 * 1000`), finished jobs TTL **7 days** (`expireAfterSeconds: 604800`), conversation list max **100**, title max **60** characters, progress saves at most once per **1000 ms**.
- User-facing texts (exact): `The assistant is unavailable right now`, `Took too long, try again`, `Interrupted by a restart, send it again`, `Member no longer exists`, `Wait for your earlier questions first`, `Too many requests, slow down`, `Waiting — N ahead of you`.
- Restart: running automation jobs → requeued; running chat jobs → `interrupted`, never re-run.
- Plans: full action details only server-side; clients get `{ ref, tool, summary, deps }`.
- Frontend follows `DESIGN.md` and existing tokens (`--primary`, `--paper`, `--ink`, `--muted`, `--urgent`, `--space-*`, `--radius-*`, `--text-*`); no new visual language.

## Review Focus

1. **SSE proxy disconnects leaking subscriptions**: closing a tab must remove the backend listener (SvelteKit proxy must abort its upstream fetch). Pinned by the subscribe/unsubscribe test in Task 1 and the open/close check in Task 11.
2. **A slow in-flight progress save landing after the final save** would overwrite the finished answer with partial text. Pinned by the "final write wins" test in Task 4.
3. **Conversation deleted while its job is queued/just claimed**: the handler must exit quietly, not crash or recreate data. Pinned by the "reply message gone" test in Task 4.
4. **Same member with two tabs/devices**: confirming a plan in one must update the other (server publishes `plan` after confirm/reject, Task 5); stale double-confirm answers 409 (Task 3 test).
5. **Member switch while an answer streams**: the client must drop the old member's state and stream. Pinned by `connect(user)` resetting state (Task 8) and the manual check in Task 11.

---

## Task 0: Pre-flight (repo state)

The working tree has many uncommitted changes, including in files this plan edits (`backend/assistant.js`, `automations.js`, `web.js`, `assistantTools.js` were edited on 2026-10-08 ~00:30). Task commits must contain only plan work.

- [ ] **Step 1: Make sure nobody else is editing the repo.** Ask the human partner to confirm no other session/editor is changing `backend/` or `frontend/src/` while this plan runs.

- [ ] **Step 2: Have the human partner commit their in-progress work** (their decision what goes in; suggest one WIP commit):

```bash
cd /mnt/storage/home/it/home_calendar
git status --short
# human partner commits their own changes, e.g.:
# git add -A && git commit -m "wip: assistant fitContext, readability fetch, k3s Dockerfiles"
```

Expected afterwards: `git status --short` prints nothing (or only files the human partner chose to leave out, none of them in `backend/` or `frontend/src/`).

- [ ] **Step 3: Create the branch and record the baseline**

```bash
cd /mnt/storage/home/it/home_calendar
git switch -c assistant-queue
npm --prefix backend test 2>&1 | tail -6
```

Expected: `# fail 0` (45 tests at time of writing).

- [ ] **Step 4: Start a throwaway Mongo for integration tests** (used by Tasks 2, 3 and 11; never the real database):

```bash
docker run -d --rm --name assistant-test-mongo -p 127.0.0.1:27099:27017 mongo:8.0.6
export MONGO_TEST_URI=mongodb://127.0.0.1:27099/assistant_test
```

Integration test files skip themselves when `MONGO_TEST_URI` is unset.

---

## Task 1: Event bus + queue core

**Files:**
- Create: `backend/assistantEvents.js`
- Create: `backend/assistantQueue.js`
- Create: `backend/test/helpers/memoryJobStore.js`
- Create: `backend/test/helpers/jobStoreContract.js`
- Test: `backend/test/queue.test.js`, `backend/test/jobStore.memory.test.js`, `backend/test/events.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `assistantEvents.js`: `publish(session, user, event)`, `subscribe(session, user, fn) → unsubscribe()`, `listenerTotal() → number`.
  - Job store interface (implemented by `memoryJobStore()` here and `mongoJobStore(collection)` in Task 2): `insert(job) → job with _id`, `claimNext(now) → job|null`, `finish(id, status, now)`, `cancelQueued(id, now) → bool`, `get(id) → job|null`, `listQueued() → job[]` (queue order), `countRunning() → number`, `countActive({ session, user, kind }) → number`, `activeByMessage(messageId) → job|null`, `activeByConversation(conversationId) → job[]`, `hasActiveAutomation(automationId) → bool`, `resetRunning(now) → { requeued: number, interrupted: job[] }`.
  - `assistantQueue.js`: `PRIORITY = { chat: 0, automation: 1 }`, `MAX_ACTIVE_PER_MEMBER = 5`, `RUN_TIMEOUT_MS = 300000`, `createQueue({ store, timeoutMs?, onPositions?, log? }) → queue` with `queue.on(kind, handler)`, `queue.enqueue({ kind, session, user, conversationId?, messageId?, automationId? }) → job`, `queue.cancel(jobId) → 'cancelled'|'stopping'|'finished'|'missing'`, `queue.ahead(jobId) → number`, `queue.activeCount(filter) → number`, `queue.activeByMessage(id)`, `queue.activeByConversation(id)`, `queue.hasActiveAutomation(id)`, `queue.recover() → { requeued, interrupted }`, `queue.start()`, `queue.idle() → Promise`. Handler signature: `async (job, { signal }) => void`; `signal.reason` is `'cancelled'` or `'timeout'` when aborted.
  - `onPositions(list)` receives `[{ job, ahead }]` for every queued job after each enqueue, claim, finish and cancel.

- [ ] **Step 1: Write the memory store and the store contract**

`backend/test/helpers/memoryJobStore.js`:

```js
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
```

`backend/test/helpers/jobStoreContract.js` (shared by the memory and Mongo store tests):

```js
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
```

`backend/test/jobStore.memory.test.js`:

```js
import { memoryJobStore } from './helpers/memoryJobStore.js';
import { jobStoreContract } from './helpers/jobStoreContract.js';

let n = 0;
jobStoreContract('memory store', { makeStore: () => memoryJobStore(), makeId: () => `id${++n}` });
```

- [ ] **Step 2: Run the contract against the memory store**

Run: `npm --prefix backend test 2>&1 | grep -E "memory store|# (pass|fail)"`
Expected: 5 `memory store:` tests pass (the store is self-contained), `# fail 0`.

- [ ] **Step 3: Write the failing event bus and queue tests**

`backend/test/events.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publish, subscribe, listenerTotal } from '../assistantEvents.js';

test('events reach only the matching member', () => {
	const got = [];
	const off = subscribe('s1', 'u1', (e) => got.push(e));
	publish('s1', 'u1', { type: 'a' });
	publish('s1', 'u2', { type: 'b' });
	publish('s2', 'u1', { type: 'c' });
	off();
	assert.deepEqual(got, [{ type: 'a' }]);
});

test('unsubscribe removes the listener', () => {
	const before = listenerTotal();
	const off = subscribe('s1', 'u9', () => {});
	assert.equal(listenerTotal(), before + 1);
	off();
	assert.equal(listenerTotal(), before);
});
```

`backend/test/queue.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, PRIORITY } from '../assistantQueue.js';
import { memoryJobStore } from './helpers/memoryJobStore.js';

const quiet = { error() {} };
const chat = (n, extra = {}) => ({ kind: 'chat', session: 's1', user: 'u1', conversationId: `c${n}`, messageId: `m${n}`, ...extra });
const auto = (n) => ({ kind: 'automation', session: 's1', user: 'u1', automationId: `a${n}` });
function gate() { let open; const p = new Promise(r => { open = r; }); return { p, open }; }

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

test('unknown job kinds are rejected at enqueue', async () => {
	const q = createQueue({ store: memoryJobStore(), log: quiet });
	await assert.rejects(() => q.enqueue({ kind: 'other' }), /unknown job kind/);
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npm --prefix backend test 2>&1 | grep -E "Cannot find|# fail"`
Expected: FAIL, `Cannot find module '.../assistantEvents.js'` / `assistantQueue.js`.

- [ ] **Step 5: Implement the event bus**

`backend/assistantEvents.js`:

```js
import { EventEmitter } from 'node:events';

// In-process events for the assistant, per member: the worker publishes
// queue positions and streaming output, each open /assistant/events stream
// subscribes to its own member only.
const bus = new EventEmitter();
bus.setMaxListeners(0);

const key = (session, user) => `${session}:${user}`;

export function publish(session, user, event) {
	bus.emit(key(session, user), event);
}

export function subscribe(session, user, fn) {
	const k = key(session, user);
	bus.on(k, fn);
	return () => bus.off(k, fn);
}

export function listenerTotal() {
	return bus.eventNames().reduce((n, name) => n + bus.listenerCount(name), 0);
}
```

- [ ] **Step 6: Implement the queue**

`backend/assistantQueue.js`:

```js
// One model job at a time for the whole backend: the GPU fits one context.
// Jobs live in a store (Mongo in production, memory in tests) so a question
// survives a closed tab or a restart. Chat jobs go before automations; a
// running job is never interrupted except by its own cancel or timeout.

export const PRIORITY = { chat: 0, automation: 1 };
export const MAX_ACTIVE_PER_MEMBER = 5;
export const RUN_TIMEOUT_MS = 5 * 60 * 1000;

export function createQueue({ store, timeoutMs = RUN_TIMEOUT_MS, onPositions = () => {}, log = console }) {
	const handlers = {};
	const running = new Map(); // job id → AbortController
	const cancelSoon = new Set(); // cancelled between claim and start
	let wake = null;
	let dirty = false;
	let started = false;
	let idleWaiters = [];

	function on(kind, handler) {
		handlers[kind] = handler;
	}

	function notify() {
		dirty = true;
		if (wake) { const w = wake; wake = null; w(); }
	}

	async function positions() {
		const [queued, runningCount] = await Promise.all([store.listQueued(), store.countRunning()]);
		return queued.map((job, i) => ({ job, ahead: runningCount + i }));
	}

	async function announce() {
		try { onPositions(await positions()); }
		catch (err) { log.error('Assistant queue positions failed:', err); }
	}

	async function enqueue(fields) {
		if (!(fields.kind in PRIORITY)) throw new Error(`unknown job kind: ${fields.kind}`);
		const job = await store.insert({
			...fields,
			priority: PRIORITY[fields.kind],
			status: 'queued',
			createdAt: new Date(),
			startedAt: null,
			finishedAt: null,
		});
		notify();
		await announce();
		return job;
	}

	async function ahead(jobId) {
		const hit = (await positions()).find(p => String(p.job._id) === String(jobId));
		return hit ? hit.ahead : 0;
	}

	async function cancel(jobId) {
		const id = String(jobId);
		const ctl = running.get(id);
		if (ctl) { ctl.abort('cancelled'); return 'stopping'; }
		if (await store.cancelQueued(jobId, new Date())) { await announce(); return 'cancelled'; }
		const job = await store.get(jobId);
		if (job?.status === 'running') {
			// Claimed but not started yet: abort as soon as it starts
			cancelSoon.add(id);
			running.get(id)?.abort('cancelled');
			return 'stopping';
		}
		return job ? 'finished' : 'missing';
	}

	async function runJob(job) {
		const id = String(job._id);
		const ctl = new AbortController();
		running.set(id, ctl);
		if (cancelSoon.delete(id)) ctl.abort('cancelled');
		const timer = setTimeout(() => ctl.abort('timeout'), timeoutMs);
		let status = 'done';
		try {
			const handler = handlers[job.kind];
			if (!handler) throw new Error(`no handler for ${job.kind}`);
			await handler(job, { signal: ctl.signal });
			if (ctl.signal.aborted) status = ctl.signal.reason === 'cancelled' ? 'cancelled' : 'error';
		} catch (err) {
			status = ctl.signal.reason === 'cancelled' ? 'cancelled' : 'error';
			if (status === 'error') log.error(`Assistant job ${id} (${job.kind}) failed:`, err);
		} finally {
			clearTimeout(timer);
			running.delete(id);
		}
		try { await store.finish(job._id, status, new Date()); }
		catch (err) { log.error(`Assistant job ${id} could not be finished:`, err); }
		await announce();
	}

	async function loop() {
		for (;;) {
			dirty = false;
			let job;
			try {
				job = await store.claimNext(new Date());
			} catch (err) {
				log.error('Assistant queue claim failed:', err);
				await new Promise(r => setTimeout(r, 5000));
				continue;
			}
			if (!job) {
				if (dirty) continue; // something was enqueued while we looked
				for (const resolve of idleWaiters) resolve();
				idleWaiters = [];
				await new Promise(r => { wake = r; });
				continue;
			}
			await announce();
			await runJob(job);
		}
	}

	function start() {
		if (started) return;
		started = true;
		loop();
	}

	// Resolves once the worker is waiting with nothing to do (tests)
	function idle() {
		return new Promise(resolve => {
			if (started && wake && running.size === 0) resolve();
			else idleWaiters.push(resolve);
		});
	}

	return {
		on, enqueue, cancel, ahead, start, idle,
		recover: () => store.resetRunning(new Date()),
		activeCount: (filter) => store.countActive(filter),
		activeByMessage: (id) => store.activeByMessage(id),
		activeByConversation: (id) => store.activeByConversation(id),
		hasActiveAutomation: (id) => store.hasActiveAutomation(id),
	};
}
```

- [ ] **Step 7: Run the tests**

Run: `npm --prefix backend test 2>&1 | tail -8`
Expected: `# fail 0`; the new `queue.test.js`, `events.test.js` and memory contract tests are included in the pass count.

- [ ] **Step 8: Commit**

```bash
cd /mnt/storage/home/it/home_calendar
git add backend/assistantEvents.js backend/assistantQueue.js backend/test/helpers/memoryJobStore.js backend/test/helpers/jobStoreContract.js backend/test/jobStore.memory.test.js backend/test/queue.test.js backend/test/events.test.js
git commit -m "feat(assistant): durable job queue core and per-member event bus"
```

---

## Task 2: Mongo job store + indexes

**Files:**
- Create: `backend/assistantJobs.js`
- Test: `backend/test/jobStore.mongo.test.js`

**Interfaces:**
- Consumes: the job store contract from Task 1 (`jobStoreContract`).
- Produces: `mongoJobStore(collection)` (same interface as `memoryJobStore`, ids are `ObjectId`), `ensureAssistantIndexes(db)` (creates indexes on `assistant_jobs`, `assistant_messages`, `assistant_conversations`).

- [ ] **Step 1: Write the failing integration test**

`backend/test/jobStore.mongo.test.js`:

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `MONGO_TEST_URI=mongodb://127.0.0.1:27099/assistant_test npm --prefix backend test 2>&1 | grep -E "Cannot find|# fail"`
Expected: FAIL, `Cannot find module '.../assistantJobs.js'`.

- [ ] **Step 3: Implement**

`backend/assistantJobs.js`:

```js
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
```

- [ ] **Step 4: Run the tests (with and without the test Mongo)**

Run: `MONGO_TEST_URI=mongodb://127.0.0.1:27099/assistant_test npm --prefix backend test 2>&1 | tail -8`
Expected: `# fail 0`, `mongo store:` contract tests and the index test pass.

Run: `npm --prefix backend test 2>&1 | grep -E "# (skipped|fail)"`
Expected: `# fail 0`, the Mongo tests counted as skipped.

- [ ] **Step 5: Commit**

```bash
git add backend/assistantJobs.js backend/test/jobStore.mongo.test.js
git commit -m "feat(assistant): Mongo job store with queue, TTL and message indexes"
```

---

## Task 3: Conversation storage + pure helpers

**Files:**
- Create: `backend/assistantConversations.js`
- Test: `backend/test/conversations.test.js` (pure, always runs), `backend/test/conversations.mongo.test.js` (integration)

**Interfaces:**
- Consumes: `actionDeps(action)` from `backend/assistantTools.js` (returns the refs an action's body depends on).
- Produces:
  - Constants: `TITLE_MAX = 60`, `INTERRUPTED_TEXT = 'Interrupted by a restart, send it again'`.
  - Pure: `titleFrom(text) → string`, `historyFromMessages(earlier, { maxHistory = 20, maxMessage = 2000 }) → [{ role, content }]`, `clientPlan(plan) → { state, results, actions: [{ ref, tool, summary, deps }] }`, `clientMessage(msg) → client view`, `clientConversation(conv, busyIds:Set<string>) → { _id, title, updatedAt, unread, busy }`.
  - `conversationStore(db)` with: `startTurn({ session, user, conversationId|null, text, now }) → { conversation, userMessage, reply } | null`, `list(who) → { conversations, unreadCount }`, `get(who, id) → { conversation, messages } | null`, `markRead(who, id)`, `unreadCount(who) → number`, `remove(who, id) → 'deleted'|'busy'|'missing'`, `thread(conversationId) → messages[]` (oldest first), `getMessage(who, id) → msg|null`, `updateReply(messageId, fields)`, `finishReply(conversationId, messageId, fields, now, { unread = true })`, `claimPlan(who, messageId) → msg|null`, `settlePlan(messageId, results) → msg|null`, `rejectPlan(who, messageId) → msg|null`, `markInterrupted(jobs, now)`. `who` is always `{ session, user }`.

- [ ] **Step 1: Write the failing pure tests**

`backend/test/conversations.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SECRET ||= 'x'.repeat(32);
const { titleFrom, historyFromMessages, clientMessage, clientConversation, TITLE_MAX } = await import('../assistantConversations.js');

test('titleFrom flattens whitespace and caps at 60 characters', () => {
	assert.equal(titleFrom('  what is\n on   today? '), 'what is on today?');
	const long = titleFrom('a'.repeat(100));
	assert.equal(Array.from(long).length, TITLE_MAX);
	assert.ok(long.endsWith('…'));
});

test('titleFrom never splits an emoji', () => {
	const t = titleFrom('😀'.repeat(80));
	assert.equal(Array.from(t).length, TITLE_MAX);
	assert.ok(!/[\uD800-\uDBFF]$/.test(t.slice(0, -1)));
});

test('historyFromMessages keeps user turns and finished assistant answers only', () => {
	const earlier = [
		{ role: 'user', content: 'q1' },
		{ role: 'assistant', content: 'a1', status: 'done' },
		{ role: 'user', content: 'q2' },
		{ role: 'assistant', content: 'partial', status: 'error' },
		{ role: 'assistant', content: '   ', status: 'done' },
		{ role: 'user', content: 'x'.repeat(3000) },
	];
	const h = historyFromMessages(earlier, { maxHistory: 20, maxMessage: 2000 });
	assert.deepEqual(h.map(m => m.role), ['user', 'assistant', 'user', 'user']);
	assert.equal(h[1].content, 'a1');
	assert.equal(h[3].content.length, 2000);
});

test('historyFromMessages keeps only the newest maxHistory turns', () => {
	const earlier = Array.from({ length: 30 }, (_, i) => ({ role: 'user', content: `q${i}` }));
	const h = historyFromMessages(earlier, { maxHistory: 20 });
	assert.equal(h.length, 20);
	assert.equal(h[0].content, 'q10');
});

test('clientMessage strips plan actions down to ref, tool, summary and deps', () => {
	const msg = {
		_id: 'm1', session: 's', user: 'u', role: 'assistant', content: 'ok', status: 'done', createdAt: new Date(0),
		plan: { state: 'review', results: [], actions: [
			{ ref: '#1', tool: 'add_todo', summary: 'Add milk', path: '/todos', body: { title: 'Milk' } },
			{ ref: '#2', tool: 'add_todo', summary: 'Tag it', path: '/todos', body: { parent: '@ref:#1' } },
		] },
	};
	const view = clientMessage(msg);
	assert.equal(view.session, undefined);
	assert.equal(view.user, undefined);
	assert.deepEqual(Object.keys(view.plan.actions[0]).sort(), ['deps', 'ref', 'summary', 'tool']);
	assert.equal(view.plan.actions[0].path, undefined);
	assert.equal(view.plan.actions[0].body, undefined);
	assert.deepEqual(view.plan.actions[1].deps, ['#1']);
	assert.equal(view.tools.length, 0);
});

test('clientConversation marks busy from the set of active conversation ids', () => {
	const c = { _id: 'c1', title: 't', updatedAt: new Date(0), unread: true, session: 's', user: 'u' };
	assert.deepEqual(clientConversation(c, new Set(['c1'])), { _id: 'c1', title: 't', updatedAt: new Date(0), unread: true, busy: true });
	assert.equal(clientConversation(c, new Set()).busy, false);
});
```

(Staged bodies reference earlier staged items as `'@ref:#N'`, `REF_PREFIX` in `assistantTools.js`; `actionDeps` returns those refs.)

- [ ] **Step 2: Run to verify failure**

Run: `npm --prefix backend test 2>&1 | grep -E "Cannot find|# fail"`
Expected: FAIL, `Cannot find module '.../assistantConversations.js'`.

- [ ] **Step 3: Implement the module**

`backend/assistantConversations.js`:

```js
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
```

- [ ] **Step 4: Run pure tests**

Run: `npm --prefix backend test 2>&1 | tail -8`
Expected: `# fail 0`.

- [ ] **Step 5: Write the integration tests**

`backend/test/conversations.mongo.test.js`:

```js
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
```

- [ ] **Step 6: Run integration tests**

Run: `MONGO_TEST_URI=mongodb://127.0.0.1:27099/assistant_test npm --prefix backend test 2>&1 | tail -8`
Expected: `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add backend/assistantConversations.js backend/test/conversations.test.js backend/test/conversations.mongo.test.js
git commit -m "feat(assistant): stored conversations, messages and plan state"
```

---

## Task 4: Chat job handler

**Files:**
- Create: `backend/assistantChatJob.js`
- Test: `backend/test/chatJob.test.js`

**Interfaces:**
- Consumes: `historyFromMessages`, `clientPlan` (Task 3); a `conversations` object with `thread`, `updateReply`, `finishReply`, `unreadCount` (Task 3 signatures).
- Produces: `UNAVAILABLE_TEXT = 'The assistant is unavailable right now'`, `TIMEOUT_TEXT = 'Took too long, try again'`, `MEMBER_GONE_TEXT = 'Member no longer exists'`, `createChatJobHandler(deps) → async (job, { signal })`. `deps`: `{ conversations, publish(session, user, event), loadMember(session, userId) → member|null, mintCookie(session, userId) → string, createExecutor({ cookie, userId, stage }) → exec, householdContext(exec) → ctx, systemPrompt(member, ctx) → string, userTurn(text) → string, runAgent({ messages, exec, signal, onText, onTool }) → { reply, finished }, saveEveryMs = 1000, maxHistory = 20, maxMessage = 2000, log = console }`. Events published (all with `conversationId` and `messageId` as strings): `start`, `text {text}`, `tool {name, summary, error, staged, done}`, `plan {plan}`, `done_actions {actions}`, `error {error}`, `end {status}`, then `unread {count}` (no ids).

- [ ] **Step 1: Write the failing tests**

`backend/test/chatJob.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SECRET ||= 'x'.repeat(32);
const { createChatJobHandler, UNAVAILABLE_TEXT, TIMEOUT_TEXT, MEMBER_GONE_TEXT } = await import('../assistantChatJob.js');

function fakeConversations(thread) {
	const writes = [];
	return {
		writes,
		finished: null,
		async thread() { return thread; },
		async updateReply(id, fields) { writes.push({ id, ...fields }); },
		async finishReply(conversationId, messageId, fields, now, opts = {}) { this.finished = { conversationId, messageId, fields, unread: opts.unread ?? true }; },
		async unreadCount() { return 3; },
	};
}

const job = { _id: 'j1', kind: 'chat', session: 's1', user: 'u1', conversationId: 'c1', messageId: 'r2' };
const baseThread = () => [
	{ _id: 'q1', role: 'user', content: 'earlier question' },
	{ _id: 'r1', role: 'assistant', content: 'earlier answer', status: 'done' },
	{ _id: 'q2', role: 'user', content: 'what now?' },
	{ _id: 'r2', role: 'assistant', content: '', status: 'queued' },
];

function deps(over = {}) {
	const events = [];
	const conversations = over.conversations || fakeConversations(baseThread());
	const exec = over.exec || { staged: [], done: [] };
	return {
		events, conversations, exec,
		d: {
			conversations,
			publish: (session, user, e) => events.push(e),
			loadMember: async () => ({ _id: 'u1', name: 'Mario', assistantConfirm: true }),
			mintCookie: () => 'session=t; user=u1',
			createExecutor: () => exec,
			householdContext: async () => ({}),
			systemPrompt: () => 'SYSTEM',
			userTurn: (t) => `[now] ${t}`,
			runAgent: async ({ onText }) => { onText('Hello'); onText(' there'); return { reply: 'Hello there', finished: true }; },
			saveEveryMs: 0,
			log: { error() {} },
			...over.d,
		},
	};
}
const run = (d, signal = new AbortController().signal) => createChatJobHandler(d)(job, { signal });

test('builds history from the thread and asks the current question last', async () => {
	let seen;
	const { d } = deps({ d: { runAgent: async ({ messages }) => { seen = messages; return { reply: 'ok', finished: true }; } } });
	await run(d);
	assert.deepEqual(seen.map(m => [m.role, m.content]), [
		['system', 'SYSTEM'],
		['user', 'earlier question'],
		['assistant', 'earlier answer'],
		['user', '[now] what now?'],
	]);
});

test('stores the answer and a staged plan, marks unread and publishes events', async () => {
	const exec = { staged: [{ ref: '#1', tool: 'add_todo', summary: 'Add milk', path: '/todos', body: {} }], done: [] };
	const { d, events, conversations } = deps({ exec });
	await run(d);
	const f = conversations.finished;
	assert.equal(f.fields.status, 'done');
	assert.equal(f.fields.content, 'Hello there');
	assert.equal(f.fields.plan.state, 'review');
	assert.equal(f.fields.plan.actions[0].path, '/todos'); // full details stored server-side
	assert.equal(f.unread, true);
	const types = events.map(e => e.type);
	assert.deepEqual(types, ['start', 'text', 'text', 'plan', 'end', 'unread']);
	const planEvent = events.find(e => e.type === 'plan');
	assert.equal(planEvent.plan.actions[0].path, undefined); // client view only
	assert.equal(planEvent.messageId, 'r2');
	assert.equal(events.at(-1).count, 3);
});

test('stop keeps the partial answer as cancelled and does not mark unread', async () => {
	const ctl = new AbortController();
	const { d, conversations, events } = deps({ d: { runAgent: async ({ onText, signal }) => {
		onText('Partial');
		ctl.abort('cancelled');
		const err = new Error('aborted'); err.name = 'AbortError';
		if (signal.aborted) throw err;
		return { reply: '', finished: false };
	} } });
	await run(d, ctl.signal);
	assert.equal(conversations.finished.fields.status, 'cancelled');
	assert.equal(conversations.finished.fields.content, 'Partial');
	assert.equal(conversations.finished.unread, false);
	assert.ok(!events.some(e => e.type === 'error'));
});

test('model failure stores the unavailable message and rethrows for the queue', async () => {
	const { d, conversations, events } = deps({ d: { runAgent: async () => { throw new Error('model server returned 500'); } } });
	await assert.rejects(() => run(d), /model server returned 500/);
	assert.equal(conversations.finished.fields.status, 'error');
	assert.equal(conversations.finished.fields.error, UNAVAILABLE_TEXT);
	assert.equal(events.find(e => e.type === 'error').error, UNAVAILABLE_TEXT);
	assert.equal(events.at(-1).type, 'unread');
});

test('timeout stores the too-long message', async () => {
	const ctl = new AbortController();
	const { d, conversations } = deps({ d: { runAgent: async () => { ctl.abort('timeout'); throw new Error('aborted'); } } });
	await assert.rejects(() => run(d, ctl.signal));
	assert.equal(conversations.finished.fields.error, TIMEOUT_TEXT);
});

test('writes that already ran are recorded even when the run fails', async () => {
	const exec = { staged: [], done: [{ ref: '#1', tool: 'sign_chore', summary: 'Signed Dishes', path: '/x', body: {} }] };
	const { d, conversations } = deps({ exec, d: { runAgent: async () => { throw new Error('boom'); } } });
	await assert.rejects(() => run(d));
	assert.deepEqual(conversations.finished.fields.doneActions, [{ ref: '#1', tool: 'sign_chore', summary: 'Signed Dishes' }]);
});

test('a missing member ends the job with a clear error', async () => {
	const { d, conversations } = deps({ d: { loadMember: async () => null } });
	await assert.rejects(() => run(d));
	assert.equal(conversations.finished.fields.error, MEMBER_GONE_TEXT);
});

test('a reply that no longer exists (conversation deleted) ends quietly', async () => {
	const conversations = fakeConversations([{ _id: 'q9', role: 'user', content: 'other' }]);
	let asked = false;
	const { d, events } = deps({ conversations, d: { runAgent: async () => { asked = true; return { reply: '', finished: true }; } } });
	await run(d);
	assert.equal(asked, false);
	assert.equal(conversations.finished, null);
	assert.equal(events.length, 0);
});

test('the final write wins over a slow in-flight progress save', async () => {
	const order = [];
	const conversations = fakeConversations(baseThread());
	conversations.updateReply = async (id, fields) => {
		await new Promise(r => setTimeout(r, 30));
		order.push(['progress', fields.content]);
	};
	conversations.finishReply = async function (c, m, fields) { order.push(['final', fields.content]); this.finished = { fields }; };
	const { d } = deps({ conversations });
	await run(d);
	assert.deepEqual(order.at(-1), ['final', 'Hello there']);
	assert.ok(order.filter(([k]) => k === 'progress').length >= 1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm --prefix backend test 2>&1 | grep -E "Cannot find|# fail"`
Expected: FAIL, `Cannot find module '.../assistantChatJob.js'`.

- [ ] **Step 3: Implement**

`backend/assistantChatJob.js`:

```js
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
		const emit = (event) => publish(session, user, { ...ids, ...event });

		const thread = await conversations.thread(conversationId);
		const at = thread.findIndex(m => String(m._id) === String(messageId));
		if (at < 0) return; // conversation deleted while queued
		let q = at - 1;
		while (q >= 0 && thread[q].role !== 'user') q--;

		const reply = { content: '', tools: [] };
		let exec = null;
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

		let failure = null;
		try {
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
			const error = status === 'cancelled' ? null : reason === 'timeout' ? TIMEOUT_TEXT : err.userFacing ? err.message : UNAVAILABLE_TEXT;
			if (status === 'error') failure = err;
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
		try { publish(session, user, { type: 'unread', count: await conversations.unreadCount({ session, user }) }); }
		catch (err) { log.error('Assistant unread count failed:', err); }
		if (failure) throw failure;
	};
}
```

- [ ] **Step 4: Run the tests**

Run: `npm --prefix backend test 2>&1 | tail -8`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add backend/assistantChatJob.js backend/test/chatJob.test.js
git commit -m "feat(assistant): queued chat job handler with stored, streamed answers"
```

---

## Task 5: Assistant routes + wiring of chat into the queue

**Files:**
- Modify: `backend/assistant.js` (remove `exclusive`, the in-memory `plans`/`prunePlans`/`PLAN_TTL_MS`, `cleanHistory`, the old SSE `POST /assistant` and old `POST /assistant/confirm`; add `initAssistant` and the new routes)

**Interfaces:**
- Consumes: `createQueue`, `MAX_ACTIVE_PER_MEMBER` (Task 1); `mongoJobStore`, `ensureAssistantIndexes` (Task 2); `conversationStore`, `clientMessage`, `clientPlan` (Task 3); `createChatJobHandler` (Task 4); `publish`, `subscribe`, `listenerTotal` (Task 1); existing `runAgent`, `householdContext`, `systemPrompt`, `userTurn`, `rateLimited`, `createExecutor`, `runAction`.
- Produces: `export async function initAssistant(database) → queue` (call once after `db.connectDB()`); routes: `POST /assistant`, `GET /assistant/conversations`, `GET /assistant/conversations/:id[?read=0]`, `POST /assistant/conversations/del`, `POST /assistant/cancel`, `POST /assistant/confirm`, `POST /assistant/plan/cancel`, `GET /assistant/events`. `runAgent`, `householdContext`, `calendarLines`, `fitContext` stay exported; `exclusive` is gone (Task 6 removes its last user).

- [ ] **Step 1: Update imports and remove the old in-memory pieces**

At the top of `backend/assistant.js`, replace the import block with:

```js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { toObjectId } from './helpers.js';
import { TOOLS, TZ, createExecutor, runAction, dateToLocal, localToDate, labelOf } from './assistantTools.js';
import { createQueue, MAX_ACTIVE_PER_MEMBER } from './assistantQueue.js';
import { mongoJobStore, ensureAssistantIndexes } from './assistantJobs.js';
import { conversationStore, clientMessage, clientPlan } from './assistantConversations.js';
import { createChatJobHandler } from './assistantChatJob.js';
import { publish, subscribe, listenerTotal } from './assistantEvents.js';
```

(`crypto` and `actionDeps` are no longer needed here; `clientPlan` uses `actionDeps`.)

Delete: `PLAN_TTL_MS`, the `// ── Pending plans` section (`plans` Map, `prunePlans`), the `// One model request at a time` section (`queue` variable and `exclusive`), and `cleanHistory` (replaced by `historyFromMessages`). Keep `MAX_HISTORY`, `MAX_MESSAGE`, `rateLimited`, `cookieHeader`, `calendarLines`, `systemPrompt`, `householdContext`, `detectLanguage`, `userTurn`, `complete`, `fitContext`, `runAgent`.

Replace `currentMember(req)` with a version usable by the worker too:

```js
async function loadMember(session, userId) {
	const id = toObjectId(userId);
	return id ? db.db.collection('users').findOne({ _id: id, session }) : null;
}

// The worker runs long after the asker's request, when their own cookie may
// have expired: it gets a short-lived token of its own, like automations.
function mintCookie(session, user) {
	return `session=${jwt.sign({ session }, process.env.SECRET, { expiresIn: '15m' })}; user=${user}`;
}

function owner(req, res) {
	const session = db.getSession(req.cookies.session);
	const user = req.cookies.user;
	if (!session || typeof user !== 'string' || !user) {
		res.status(401).send({ error: 'Unauthorized' });
		return null;
	}
	return { session, user };
}
```

- [ ] **Step 2: Add `initAssistant`** (below `runAgent`):

```js
// ── Queue wiring ────────────────────────────────────────────────────────────
let queue = null;
let conversations = null;

function publishPositions(list) {
	for (const { job, ahead } of list) {
		if (job.kind !== 'chat') continue;
		publish(job.session, job.user, { type: 'queue', conversationId: String(job.conversationId), messageId: String(job.messageId), ahead });
	}
}

// Call once after db.connectDB(): indexes, the queue, the chat handler and
// restart recovery. The caller starts the worker once automations are wired.
export async function initAssistant(database) {
	await ensureAssistantIndexes(database);
	conversations = conversationStore(database);
	queue = createQueue({ store: mongoJobStore(database.collection('assistant_jobs')), onPositions: publishPositions });
	queue.on('chat', createChatJobHandler({
		conversations, publish, loadMember, mintCookie, createExecutor, householdContext,
		systemPrompt, userTurn, runAgent, maxHistory: MAX_HISTORY, maxMessage: MAX_MESSAGE,
	}));
	const { requeued, interrupted } = await queue.recover();
	await conversations.markInterrupted(interrupted);
	if (requeued || interrupted.length) console.log(`Assistant recovery: ${requeued} automation run(s) requeued, ${interrupted.length} chat question(s) interrupted`);
	return queue;
}
```

- [ ] **Step 3: Replace `POST /assistant` and `POST /assistant/confirm` with the new routes** (delete the old two handlers entirely; keep `export default router;` at the end):

```js
// ── Routes ──────────────────────────────────────────────────────────────────

const objectIdOr404 = (value, res) => {
	const id = toObjectId(value);
	if (!id) res.status(404).send({ error: 'Not found' });
	return id;
};

// Stores the question and queues it. The answer arrives on /assistant/events
// and stays in the conversation.
router.post('/assistant', async (req, res) => {
	const who = owner(req, res);
	if (!who) return;
	const message = req.body?.message;
	if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) {
		return res.status(400).send({ error: 'Invalid message' });
	}
	if (rateLimited(who.session)) return res.status(429).send({ error: 'Too many requests, slow down' });
	try {
		if (!(await loadMember(who.session, who.user))) return res.status(400).send({ error: 'Pick a member first' });
		if (await queue.activeCount({ ...who, kind: 'chat' }) >= MAX_ACTIVE_PER_MEMBER) {
			return res.status(429).send({ error: 'Wait for your earlier questions first' });
		}
		let conversationId = null;
		if (req.body.conversationId != null) {
			conversationId = objectIdOr404(req.body.conversationId, res);
			if (!conversationId) return;
		}
		const turn = await conversations.startTurn({ ...who, conversationId, text: message.trim(), now: new Date() });
		if (!turn) return res.status(404).send({ error: 'Not found' });
		const job = await queue.enqueue({ kind: 'chat', ...who, conversationId: turn.conversation._id, messageId: turn.reply._id });
		res.status(201).send({
			conversationId: String(turn.conversation._id),
			userMessageId: String(turn.userMessage._id),
			messageId: String(turn.reply._id),
			ahead: await queue.ahead(job._id),
		});
	} catch (err) {
		console.error('Assistant enqueue failed:', err);
		if (!res.headersSent) res.status(503).send({ error: 'The assistant is unavailable right now' });
	}
});

router.get('/assistant/conversations', async (req, res) => {
	const who = owner(req, res);
	if (!who) return;
	try {
		res.send(await conversations.list(who));
	} catch (err) {
		console.error('Assistant list failed:', err);
		res.status(500).send({ error: 'Internal server error' });
	}
});

router.get('/assistant/conversations/:id', async (req, res) => {
	const who = owner(req, res);
	if (!who) return;
	const id = objectIdOr404(req.params.id, res);
	if (!id) return;
	try {
		const found = await conversations.get(who, id);
		if (!found) return res.status(404).send({ error: 'Not found' });
		if (req.query.read !== '0' && found.conversation.unread) {
			await conversations.markRead(who, id);
			publish(who.session, who.user, { type: 'unread', count: await conversations.unreadCount(who) });
		}
		res.send({
			conversation: { _id: String(found.conversation._id), title: found.conversation.title, updatedAt: found.conversation.updatedAt },
			messages: found.messages.map(clientMessage),
		});
	} catch (err) {
		console.error('Assistant conversation failed:', err);
		res.status(500).send({ error: 'Internal server error' });
	}
});

router.post('/assistant/conversations/del', async (req, res) => {
	const who = owner(req, res);
	if (!who) return;
	const id = objectIdOr404(req.body?.id, res);
	if (!id) return;
	try {
		if (!(await conversations.get(who, id))) return res.status(404).send({ error: 'Not found' });
		const jobs = await queue.activeByConversation(id);
		if (jobs.some(j => j.status === 'running')) return res.status(409).send({ error: 'Wait until the answer is finished' });
		for (const j of jobs) await queue.cancel(j._id);
		const result = await conversations.remove(who, id);
		if (result === 'busy') return res.status(409).send({ error: 'Wait until the answer is finished' });
		if (result === 'missing') return res.status(404).send({ error: 'Not found' });
		publish(who.session, who.user, { type: 'unread', count: await conversations.unreadCount(who) });
		res.send({ deleted: true });
	} catch (err) {
		console.error('Assistant delete failed:', err);
		res.status(500).send({ error: 'Internal server error' });
	}
});

// Cancels a waiting question or stops one being answered
router.post('/assistant/cancel', async (req, res) => {
	const who = owner(req, res);
	if (!who) return;
	const id = objectIdOr404(req.body?.messageId, res);
	if (!id) return;
	try {
		const msg = await conversations.getMessage(who, id);
		if (!msg) return res.status(404).send({ error: 'Not found' });
		const job = await queue.activeByMessage(id);
		if (!job) return res.status(409).send({ error: 'Already finished', status: msg.status });
		const result = await queue.cancel(job._id);
		if (result === 'cancelled') {
			// It never ran, so no handler will record it
			await conversations.finishReply(msg.conversationId, id, { status: 'cancelled' }, new Date(), { unread: false });
			publish(who.session, who.user, { type: 'end', conversationId: String(msg.conversationId), messageId: String(id), status: 'cancelled' });
		}
		res.send({ status: result });
	} catch (err) {
		console.error('Assistant cancel failed:', err);
		res.status(500).send({ error: 'Internal server error' });
	}
});

// Runs the reviewed plan: selected actions in order, without the model.
// Stops at the first failure and records what ran.
router.post('/assistant/confirm', async (req, res) => {
	const who = owner(req, res);
	if (!who) return;
	const id = objectIdOr404(req.body?.messageId, res);
	if (!id) return;
	try {
		const msg = await conversations.claimPlan(who, id);
		if (!msg) {
			const current = await conversations.getMessage(who, id);
			if (!current?.plan) return res.status(404).send({ error: 'Not found' });
			return res.status(409).send({ error: 'This list was already handled', state: current.plan.state });
		}
		const selected = new Set(Array.isArray(req.body.refs) ? req.body.refs : []);
		const ids = {};
		const results = [];
		let failed = false;
		for (const action of msg.plan.actions) {
			if (!selected.has(action.ref)) { results.push({ ref: action.ref, status: 'skipped' }); continue; }
			if (failed) { results.push({ ref: action.ref, status: 'not_run' }); continue; }
			try {
				const created = await runAction(action, cookieHeader(req), ids);
				if (created) ids[action.ref] = created;
				results.push({ ref: action.ref, status: 'done' });
			} catch (err) {
				failed = true;
				results.push({ ref: action.ref, status: 'failed', error: err.message });
			}
		}
		const settled = await conversations.settlePlan(id, results);
		publish(who.session, who.user, { type: 'plan', conversationId: String(msg.conversationId), messageId: String(id), plan: clientPlan(settled.plan) });
		res.send({ results });
	} catch (err) {
		console.error('Assistant confirm failed:', err);
		if (!res.headersSent) res.status(500).send({ error: 'Internal server error' });
	}
});

router.post('/assistant/plan/cancel', async (req, res) => {
	const who = owner(req, res);
	if (!who) return;
	const id = objectIdOr404(req.body?.messageId, res);
	if (!id) return;
	try {
		const msg = await conversations.rejectPlan(who, id);
		if (!msg) {
			const current = await conversations.getMessage(who, id);
			if (!current?.plan) return res.status(404).send({ error: 'Not found' });
			return res.status(409).send({ error: 'This list was already handled', state: current.plan.state });
		}
		publish(who.session, who.user, { type: 'plan', conversationId: String(msg.conversationId), messageId: String(id), plan: clientPlan(msg.plan) });
		res.send({ state: 'rejected' });
	} catch (err) {
		console.error('Assistant plan cancel failed:', err);
		res.status(500).send({ error: 'Internal server error' });
	}
});

// The member's live stream: queue positions, streaming answers, unread count
router.get('/assistant/events', (req, res) => {
	const who = owner(req, res);
	if (!who) return;
	res.writeHead(200, {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache, no-transform',
		Connection: 'keep-alive',
	});
	res.flushHeaders();
	res.write(': connected\n\n');
	const off = subscribe(who.session, who.user, (event) => res.write(`data: ${JSON.stringify(event)}\n\n`));
	const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
	console.log(`Assistant stream opened (${listenerTotal()} open)`);
	req.on('close', () => {
		clearInterval(heartbeat);
		off();
		console.log(`Assistant stream closed (${listenerTotal()} open)`);
	});
});
```

- [ ] **Step 4: Check the module still loads and old tests pass**

Run: `npm --prefix backend test 2>&1 | tail -8`
Expected: `# fail 0` (`agent.test.js` imports `assistant.js`, so a broken import fails here).

Run: `grep -n "exclusive\|plans\.\|cleanHistory\|PLAN_TTL" backend/assistant.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add backend/assistant.js
git commit -m "feat(assistant): queue-backed chat routes, stored conversations, event stream"
```

---

## Task 6: Automations through the queue + backend startup wiring

**Files:**
- Modify: `backend/automations.js` (imports; `report`; `runAutomation`; new `automationJob`, `initAutomations`, `interruptedAutomations`; `startScheduler` recovery)
- Modify: `backend/backend.js` (startup order)
- Test: `backend/test/automationsQueue.test.js`

**Interfaces:**
- Consumes: the queue from `initAssistant` (Task 5): `queue.on`, `queue.enqueue`, `queue.hasActiveAutomation`, `queue.start`.
- Produces: `initAutomations(queue)` (registers the `automation` handler), `interruptedAutomations(stuck, hasActiveAutomation) → docs`.

- [ ] **Step 1: Write the failing test**

`backend/test/automationsQueue.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SECRET ||= 'x'.repeat(32);
const { interruptedAutomations } = await import('../automations.js');

test('only automations without a queued or running job are recorded as interrupted', async () => {
	const stuck = [{ _id: 'a1' }, { _id: 'a2' }, { _id: 'a3' }];
	const active = new Set(['a2']);
	const out = await interruptedAutomations(stuck, async (id) => active.has(id));
	assert.deepEqual(out.map(d => d._id), ['a1', 'a3']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm --prefix backend test 2>&1 | grep -E "interruptedAutomations|# fail"`
Expected: FAIL (`interruptedAutomations is not a function`).

- [ ] **Step 3: Change `automations.js`**

Import line: replace

```js
import { runAgent, exclusive, householdContext, calendarLines } from './assistant.js';
```

with

```js
import { runAgent, householdContext, calendarLines } from './assistant.js';
```

Delete the `RUN_TIMEOUT_MS` constant (the queue owns the 5-minute timeout now).

Replace the whole `report(doc)` function with:

```js
// Runs inside the assistant queue's worker: `signal` carries the queue's
// 5-minute timeout, which starts when the worker picks the job, so time
// spent waiting behind chat or other runs never counts against it.
async function report(doc, signal) {
	// Signed when the run starts, not when it was queued: the token only has
	// to outlive the run itself. The household's own session, so tools see
	// exactly what the UI shows the member who created the automation.
	const token = jwt.sign({ session: doc.session }, process.env.SECRET, { expiresIn: '15m' });
	const cookie = `session=${token}; user=${doc.createdBy || ''}`;
	const exec = createExecutor({ cookie, userId: doc.createdBy || '', stage: true });
	// Fails loudly (instead of silently degrading to an empty household
	// context) if the token above can't even authenticate.
	await exec.load('users');
	const messages = [
		{ role: 'system', content: reportPrompt(doc, await householdContext(exec)) },
		{ role: 'user', content: doc.prompt },
	];
	const { reply, finished } = await runAgent({ messages, tools: READ_TOOLS, exec, signal, maxSteps: MAX_STEPS });
	if (!finished) throw new Error(signal.aborted ? 'timed out' : 'stopped after too many steps');
	return reply.trim() || '(no output)';
}
```

Replace the whole `runAutomation(doc)` function with these three pieces:

```js
let queue = null;

// Registers the automation job handler on the assistant queue (backend.js)
export function initAutomations(q) {
	queue = q;
	q.on('automation', automationJob);
}

// Returns false when this automation is already queued or running (slot
// skipped). runningSince now means "queued or running". A claim older than
// STALE_RUN_MS is treated as abandoned and can be reclaimed.
async function runAutomation(doc) {
	const claimed = await automations().findOneAndUpdate(
		{ _id: doc._id, $or: [{ runningSince: null }, { runningSince: { $lt: new Date(Date.now() - STALE_RUN_MS) } }] },
		{ $set: { runningSince: new Date() } },
	);
	if (!claimed) return false;
	try {
		await queue.enqueue({ kind: 'automation', session: claimed.session, user: claimed.createdBy || '', automationId: claimed._id });
	} catch (err) {
		console.error(`Automation "${doc.name}" could not be queued:`, err);
		await finishRun(claimed, { ok: false, error: 'could not be queued' })
			.catch(err2 => console.error(`Automation "${doc.name}" reset failed:`, err2));
	}
	return true;
}

async function automationJob(job, { signal }) {
	const doc = await automations().findOne({ _id: job.automationId });
	if (!doc) return; // deleted while queued
	let result;
	try {
		const text = await report(doc, signal);
		result = { ok: true, text: text.slice(0, MAX_RESULT) };
	} catch (err) {
		console.error(`Automation "${doc.name}" failed:`, err);
		const timedOut = signal.reason === 'timeout' || err.name === 'AbortError' || err.message === 'timed out';
		result = { ok: false, error: timedOut ? 'timed out' : String(err.message || err).slice(0, 300) };
	}
	try {
		await finishRun(doc, result);
	} catch (err) {
		// finishRun itself failed (e.g. a transient Mongo error): retry just the
		// runningSince reset so the automation doesn't stay "running" forever.
		console.error(`Automation "${doc.name}" finishRun failed, retrying reset:`, err);
		await automations().updateOne({ _id: doc._id }, { $set: { runningSince: null, lastStatus: 'error' } })
			.catch(err2 => console.error(`Automation "${doc.name}" reset retry failed:`, err2));
	}
}

// A restart mid-run leaves runningSince set. Automations whose job is still
// in the queue (requeued by the assistant queue's recovery) just run again;
// the rest were really interrupted.
export async function interruptedAutomations(stuck, hasActiveAutomation) {
	const out = [];
	for (const doc of stuck) if (!(await hasActiveAutomation(doc._id))) out.push(doc);
	return out;
}
```

In `startScheduler()`, replace the recovery chain with:

```js
	automations().find({ runningSince: { $ne: null } }).toArray()
		.then(stuck => interruptedAutomations(stuck, id => queue.hasActiveAutomation(id)))
		.then(stuck => Promise.all(stuck.map(doc => finishRun(doc, { ok: false, error: 'interrupted by a restart' }, 'interrupted'))))
		.catch(err => console.error('Automation recovery failed:', err));
```

- [ ] **Step 4: Wire startup in `backend.js`**

Change the two imports:

```js
import assistantRouter, { initAssistant } from './assistant.js';
import automationsRouter, { startScheduler, initAutomations } from './automations.js';
```

Directly after `await db.connectDB();` add:

```js
// The assistant queue must be ready (and recovered) before the scheduler
// looks at automations left "running" by a restart.
const assistantQueue = await initAssistant(db.db);
initAutomations(assistantQueue);
```

Replace the existing `startScheduler();` line with:

```js
startScheduler();
assistantQueue.start();
```

- [ ] **Step 5: Run all backend tests**

Run: `MONGO_TEST_URI=mongodb://127.0.0.1:27099/assistant_test npm --prefix backend test 2>&1 | tail -8`
Expected: `# fail 0`.

Run: `grep -rn "exclusive" backend/*.js`
Expected: no output.

- [ ] **Step 6: Smoke-start the backend against the test Mongo**

```bash
cd /mnt/storage/home/it/home_calendar/backend
mkdir -p /tmp/aq-keys && openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/aq-keys/private.key -out /tmp/aq-keys/certificate.crt -days 1 -subj "/CN=localhost" 2>/dev/null && cp /tmp/aq-keys/certificate.crt /tmp/aq-keys/ca_bundle.crt
ls keys 2>/dev/null || ln -s /tmp/aq-keys keys
ss -tln | grep -q ':3000 ' && echo "port 3000 is busy: stop whatever uses it first"   # backend.js hardcodes PORT = 3000
SECRET=$(printf 'x%.0s' {1..40}) MONGO_URI=mongodb://127.0.0.1:27099/assistant_smoke timeout 8 node backend.js 2>&1 | head -20
[ -L keys ] && rm keys
```

Expected: `Connected to MongoDB`, `Server running on https://localhost:3000`, no stack trace. (`keys` is a temporary symlink to throwaway certs only if the real `keys/` folder is absent; it is removed afterwards and is git-ignored either way.)

- [ ] **Step 7: Commit**

```bash
cd /mnt/storage/home/it/home_calendar
git add backend/automations.js backend/backend.js backend/test/automationsQueue.test.js
git commit -m "feat(automations): run through the assistant queue; recovery keeps requeued runs"
```

---

## Task 7: Frontend proxies + client API helpers

**Files:**
- Modify: `frontend/src/routes/api/assistant/+server.js`
- Create: `frontend/src/routes/api/assistantConversations/+server.js`, `frontend/src/routes/api/assistantConversation/+server.js`, `frontend/src/routes/api/assistantDeleteConversation/+server.js`, `frontend/src/routes/api/assistantCancel/+server.js`, `frontend/src/routes/api/assistantPlanCancel/+server.js`, `frontend/src/routes/api/assistantEvents/+server.js`
- Keep: `frontend/src/routes/api/assistantConfirm/+server.js` (already proxies `assistant/confirm`; body now `{ messageId, refs }`)
- Create: `frontend/src/lib/assistant/api.js`

**Interfaces:**
- Consumes: backend routes from Task 5; `getBackend`, `postBackend` from `$lib/requests`.
- Produces (`$lib/assistant/api.js`, every function resolves `{ ok, status, data }`, never throws): `sendMessage({ message, conversationId })`, `listConversations()`, `getConversation(id, { read = true })`, `deleteConversation(id)`, `cancelMessage(messageId)`, `confirmPlan(messageId, refs)`, `rejectPlan(messageId)`.

- [ ] **Step 1: Replace the assistant proxy** (it no longer streams)

`frontend/src/routes/api/assistant/+server.js`:

```js
import { postBackend } from '$lib/requests';

// Stores and queues a question; the answer arrives on /api/assistantEvents
export async function POST({ request }) {
	return await postBackend(request, 'assistant');
}
```

- [ ] **Step 2: Add the JSON proxies**

`frontend/src/routes/api/assistantConversations/+server.js`:

```js
import { getBackend } from '$lib/requests';

export async function GET({ request }) {
	return await getBackend(request, 'assistant/conversations');
}
```

`frontend/src/routes/api/assistantConversation/+server.js`:

```js
import { json } from '@sveltejs/kit';
import { getBackend } from '$lib/requests';

export async function GET({ request, url }) {
	const id = url.searchParams.get('id') || '';
	if (!/^[a-f0-9]{24}$/.test(id)) return json({ error: 'Not found' }, { status: 404 });
	const read = url.searchParams.get('read') === '0' ? '?read=0' : '';
	return await getBackend(request, `assistant/conversations/${id}${read}`);
}
```

`frontend/src/routes/api/assistantDeleteConversation/+server.js`:

```js
import { postBackend } from '$lib/requests';

export async function POST({ request }) {
	return await postBackend(request, 'assistant/conversations/del');
}
```

`frontend/src/routes/api/assistantCancel/+server.js`:

```js
import { postBackend } from '$lib/requests';

export async function POST({ request }) {
	return await postBackend(request, 'assistant/cancel');
}
```

`frontend/src/routes/api/assistantPlanCancel/+server.js`:

```js
import { postBackend } from '$lib/requests';

export async function POST({ request }) {
	return await postBackend(request, 'assistant/plan/cancel');
}
```

- [ ] **Step 3: Add the event stream proxy** (must end the upstream request when the browser goes away)

`frontend/src/routes/api/assistantEvents/+server.js`:

```js
// The member's live assistant stream, passed straight through. When the
// browser disconnects, the upstream request is aborted so the backend drops
// its subscription.
export async function GET({ request }) {
	const upstream = new AbortController();
	request.signal.addEventListener('abort', () => upstream.abort(), { once: true });
	try {
		const backend = await fetch('https://backend:3000/assistant/events', {
			headers: { Cookie: request.headers.get('Cookie') || '' },
			signal: upstream.signal,
		});
		if (!backend.ok || !backend.body) {
			upstream.abort();
			return new Response(null, { status: backend.status || 502 });
		}
		const body = new ReadableStream({
			async start(controller) {
				const reader = backend.body.getReader();
				try {
					for (;;) {
						const { value, done } = await reader.read();
						if (done) break;
						controller.enqueue(value);
					}
				} catch {
					// aborted: browser left
				}
				try { controller.close(); } catch { /* already closed */ }
			},
			cancel() { upstream.abort(); },
		});
		return new Response(body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform',
				'X-Accel-Buffering': 'no',
			},
		});
	} catch {
		return new Response(null, { status: 502 });
	}
}
```

- [ ] **Step 4: Client API helpers**

`frontend/src/lib/assistant/api.js`:

```js
// Browser-side calls for the assistant. Each resolves { ok, status, data } and
// never throws, so callers can show the server's message (429, 503, 409…).
async function call(path, options) {
	try {
		const res = await fetch(path, options);
		const data = await res.json().catch(() => ({}));
		return { ok: res.ok, status: res.status, data };
	} catch {
		return { ok: false, status: 0, data: { error: 'Could not reach the server' } };
	}
}

const post = (path, body) => call(path, {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(body),
});

export const sendMessage = ({ message, conversationId = null }) => post('/api/assistant', { message, conversationId });
export const listConversations = () => call('/api/assistantConversations');
export const getConversation = (id, { read = true } = {}) =>
	call(`/api/assistantConversation?id=${encodeURIComponent(id)}${read ? '' : '&read=0'}`);
export const deleteConversation = (id) => post('/api/assistantDeleteConversation', { id });
export const cancelMessage = (messageId) => post('/api/assistantCancel', { messageId });
export const confirmPlan = (messageId, refs) => post('/api/assistantConfirm', { messageId, refs });
export const rejectPlan = (messageId) => post('/api/assistantPlanCancel', { messageId });
```

- [ ] **Step 5: Build check**

Run: `cd /mnt/storage/home/it/home_calendar/frontend && npm run build 2>&1 | tail -5`
Expected: build succeeds (`✓ built` / `Wrote site`), no errors. (The old `AssistantChat.svelte` still compiles; it just won't work against the new API until Task 9.)

- [ ] **Step 6: Commit**

```bash
cd /mnt/storage/home/it/home_calendar
git add frontend/src/routes/api/assistant frontend/src/routes/api/assistantConversations frontend/src/routes/api/assistantConversation frontend/src/routes/api/assistantDeleteConversation frontend/src/routes/api/assistantCancel frontend/src/routes/api/assistantPlanCancel frontend/src/routes/api/assistantEvents frontend/src/lib/assistant/api.js
git commit -m "feat(frontend): proxies and client helpers for the queued assistant"
```

---

## Task 8: Client assistant store

**Files:**
- Create: `frontend/src/lib/assistant/store.js`

**Interfaces:**
- Consumes: `$lib/assistant/api.js` (Task 7); server events from Task 5 (`queue`, `start`, `text`, `tool`, `plan`, `done_actions`, `error`, `end`, `unread`).
- Produces (Svelte stores): `conversations` (`[{ _id, title, updatedAt, unread, busy }]`), `unreadCount` (number), `threads` (`{ [conversationId]: message[] }`), `listLoaded` (bool), `selected` (conversation id requested by "All chats →", `undefined` when none). Functions: `connect(user)`, `disconnect()`, `refresh()`, `open(id, { read = true }) → messages|null`, `send(text, conversationId|null) → { conversationId } | { error, status }`, `cancel(conversationId, messageId)`, `togglePlanAction(conversationId, messageId, ref)`, `confirm(conversationId, messageId) → { error? }`, `reject(conversationId, messageId)`, `remove(id) → { error? }`, `setVisible(key, conversationId|null)`, `onHouseholdChange(fn) → unsubscribe`. UI message shape: server client view + `ahead` (number|null) + plan actions with `checked`, `status`, `error`.

- [ ] **Step 1: Write the store**

`frontend/src/lib/assistant/store.js`:

```js
import { writable, get } from 'svelte/store';
import * as api from './api.js';

// Assistant state shared by the home panel and the Assistant tab: the
// member's conversation list, the conversations loaded so far, and one live
// event stream per page. The server is the source of truth; events only make
// the open pages live, and every (re)connect reloads from the server.

export const conversations = writable([]);
export const unreadCount = writable(0);
export const threads = writable({});
export const listLoaded = writable(false);
export const selected = writable(undefined);

let source = null;
let member = null;
let retryTimer = null;
const pending = new Map(); // messageId → events that arrived before the message
const visible = new Map(); // 'home' | 'tab' → conversationId shown there
const changeListeners = new Set();

function uiPlan(plan) {
	if (!plan) return null;
	const results = new Map((plan.results || []).map(r => [r.ref, r]));
	return {
		...plan,
		actions: plan.actions.map(a => ({
			...a,
			checked: true,
			status: results.get(a.ref)?.status ?? (plan.state === 'rejected' ? 'skipped' : null),
			error: results.get(a.ref)?.error ?? null,
		})),
	};
}

const uiMessage = (m) => ({ ...m, ahead: null, plan: uiPlan(m.plan) });

function householdChanged() {
	for (const fn of changeListeners) fn();
}

export function onHouseholdChange(fn) {
	changeListeners.add(fn);
	return () => changeListeners.delete(fn);
}

export function setVisible(key, conversationId) {
	if (conversationId) visible.set(key, conversationId);
	else visible.delete(key);
}

const isVisible = (id) => [...visible.values()].includes(id);

export function connect(user) {
	if (typeof window === 'undefined' || !user) return;
	if (user === member && source) return;
	disconnect();
	member = user;
	conversations.set([]);
	threads.set({});
	unreadCount.set(0);
	listLoaded.set(false);
	open_stream();
}

function open_stream() {
	clearTimeout(retryTimer);
	source = new EventSource('/api/assistantEvents');
	source.onopen = () => refresh();
	source.onmessage = (e) => {
		try { apply(JSON.parse(e.data)); } catch { /* ignore malformed event */ }
	};
	source.onerror = () => {
		// The browser retries by itself unless the stream was refused (401/502):
		// then it stays closed, so try again in a while.
		if (source && source.readyState === EventSource.CLOSED) {
			source = null;
			const who = member;
			retryTimer = setTimeout(() => { if (member === who) open_stream(); }, 5000);
		}
	};
}

export function disconnect() {
	clearTimeout(retryTimer);
	source?.close();
	source = null;
	member = null;
	pending.clear();
}

async function refreshList() {
	const r = await api.listConversations();
	if (!r.ok) return;
	conversations.set(r.data.conversations);
	unreadCount.set(r.data.unreadCount);
	listLoaded.set(true);
}

export async function refresh() {
	await refreshList();
	for (const id of Object.keys(get(threads))) await open(id, { read: isVisible(id) });
}

export async function open(id, { read = true } = {}) {
	const r = await api.getConversation(id, { read });
	if (!r.ok) {
		if (r.status === 404) threads.update(t => { const c = { ...t }; delete c[id]; return c; });
		return null;
	}
	const messages = r.data.messages.map(uiMessage);
	for (const m of messages) pending.delete(m._id);
	threads.update(t => ({ ...t, [id]: messages }));
	if (read) conversations.update(list => list.map(c => (c._id === id ? { ...c, unread: false } : c)));
	return messages;
}

function patchMessage(conversationId, messageId, fn) {
	let found = false;
	threads.update(t => {
		const list = t[conversationId];
		if (!list) return t;
		const i = list.findIndex(m => m._id === messageId);
		if (i < 0) return t;
		found = true;
		const copy = [...list];
		copy[i] = fn({ ...copy[i] });
		return { ...t, [conversationId]: copy };
	});
	return found;
}

function applyToMessage(m, ev) {
	switch (ev.type) {
		case 'queue': m.ahead = ev.ahead; break;
		case 'start': m.status = 'running'; m.ahead = 0; break;
		case 'text': m.content = (m.content || '') + ev.text; break;
		case 'tool': m.tools = [...(m.tools || []), { name: ev.name, summary: ev.summary, error: ev.error, staged: ev.staged, done: ev.done }]; break;
		case 'plan': m.plan = uiPlan(ev.plan); break;
		case 'done_actions': m.doneActions = ev.actions; break;
		case 'error': m.error = ev.error; break;
		case 'end': m.status = ev.status; m.content = (m.content || '').trim(); break;
	}
	return m;
}

function apply(ev) {
	if (ev.type === 'unread') { unreadCount.set(ev.count); return; }
	const { conversationId, messageId } = ev;
	if (!conversationId || !messageId) return;
	const hit = patchMessage(conversationId, messageId, m => applyToMessage(m, ev));
	if (!hit) {
		const list = pending.get(messageId) || [];
		list.push(ev);
		pending.set(messageId, list.slice(-200));
	}
	if (ev.type === 'done_actions' || (ev.type === 'plan' && ev.plan.results?.some(r => r.status === 'done'))) householdChanged();
	if (ev.type === 'end') {
		refreshList();
		// Reload what the member is looking at: final text as stored, marks it read
		if (isVisible(conversationId)) open(conversationId);
	}
	if (ev.type === 'queue' || ev.type === 'start') {
		conversations.update(list => list.map(c => (c._id === conversationId ? { ...c, busy: true } : c)));
	}
}

export async function send(text, conversationId = null) {
	const r = await api.sendMessage({ message: text, conversationId });
	if (!r.ok) return { error: r.data.error || 'The assistant is unavailable right now', status: r.status };
	const { conversationId: cid, messageId, userMessageId, ahead } = r.data;
	if (get(threads)[cid]) {
		let reply = { _id: messageId, role: 'assistant', content: '', status: 'queued', ahead, error: null, tools: [], plan: null, doneActions: null };
		for (const ev of pending.get(messageId) || []) reply = applyToMessage(reply, ev);
		pending.delete(messageId);
		threads.update(t => ({ ...t, [cid]: [...t[cid], { _id: userMessageId, role: 'user', content: text, status: null, tools: [], plan: null }, reply] }));
	} else {
		await open(cid);
	}
	await refreshList();
	return { conversationId: cid };
}

export async function cancel(conversationId, messageId) {
	const r = await api.cancelMessage(messageId);
	if (!r.ok && r.status === 409) await open(conversationId);
}

export function togglePlanAction(conversationId, messageId, ref) {
	patchMessage(conversationId, messageId, m => {
		const plan = { ...m.plan, actions: m.plan.actions.map(a => ({ ...a })) };
		const action = plan.actions.find(a => a.ref === ref);
		action.checked = !action.checked;
		if (!action.checked) {
			// Unticking an action also unticks the ones built on it
			let changed = true;
			while (changed) {
				changed = false;
				for (const a of plan.actions) {
					if (a.checked && a.deps.some(dep => plan.actions.find(x => x.ref === dep && !x.checked))) {
						a.checked = false;
						changed = true;
					}
				}
			}
		}
		m.plan = plan;
		return m;
	});
}

export async function confirm(conversationId, messageId) {
	const message = get(threads)[conversationId]?.find(m => m._id === messageId);
	if (!message?.plan) return {};
	const refs = message.plan.actions.filter(a => a.checked).map(a => a.ref);
	if (!refs.length) return reject(conversationId, messageId);
	patchMessage(conversationId, messageId, m => ({ ...m, plan: { ...m.plan, state: 'running' } }));
	const r = await api.confirmPlan(messageId, refs);
	await open(conversationId, { read: false });
	if (r.ok && r.data.results.some(x => x.status === 'done')) householdChanged();
	return r.ok ? {} : { error: r.data.error };
}

export async function reject(conversationId, messageId) {
	const r = await api.rejectPlan(messageId);
	await open(conversationId, { read: false });
	return r.ok ? {} : { error: r.data.error };
}

export async function remove(id) {
	const r = await api.deleteConversation(id);
	if (!r.ok) return { error: r.data.error || 'Could not delete' };
	threads.update(t => { const c = { ...t }; delete c[id]; return c; });
	await refreshList();
	return {};
}
```

- [ ] **Step 2: Build check**

Run: `cd /mnt/storage/home/it/home_calendar/frontend && npm run build 2>&1 | tail -5`
Expected: build succeeds (the store isn't imported yet; this catches syntax errors once it is in Task 9 — run it again there).

- [ ] **Step 3: Commit**

```bash
cd /mnt/storage/home/it/home_calendar
git add frontend/src/lib/assistant/store.js
git commit -m "feat(frontend): shared assistant store with one live stream per page"
```

---

## Task 9: Thread + input components, home panel on the store

**Files:**
- Create: `frontend/src/lib/assistant/AssistantThread.svelte`
- Create: `frontend/src/lib/assistant/AssistantInput.svelte`
- Modify (rewrite): `frontend/src/lib/components/AssistantChat.svelte`
- Modify: `frontend/src/lib/menus/home/home.svelte:794` (pass `active`)
- Modify: `frontend/src/routes/+page.svelte` (`viewModeChanged` accepts a page name)

**Interfaces:**
- Consumes: store from Task 8.
- Produces: `<AssistantThread conversationId messages onAskAgain maxHeight />`, `<AssistantInput onSend placeholder />` (`onSend(text)` resolves `{ error }` to keep the text and show the error, or `{}`), `<AssistantChat onChange active />` (home panel). Navigation: `window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: 'assistant' }))` opens the Assistant tab (Task 10 registers the name).

- [ ] **Step 1: `AssistantInput.svelte`** (the composer and voice code moved out of `AssistantChat.svelte`, unchanged in behaviour except that text stays when sending fails)

```svelte
<script>
	// Text + voice input. `onSend(text)` resolves { error } when the message
	// was not accepted (queue full, server down): the text then stays.
	export let onSend = async () => ({});
	export let placeholder = 'Ask, or tell me what you did';

	let input = '';
	let sending = false;
	let error = null;

	let recorder = null;
	let recording = false;
	let transcribing = false;
	const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

	async function submit(text = input) {
		text = text.trim();
		if (!text || sending) return;
		sending = true;
		error = null;
		const result = await onSend(text);
		sending = false;
		if (result?.error) {
			error = result.error;
			input = text;
		} else {
			input = '';
		}
	}

	async function toggleRecording() {
		if (recording) {
			recorder?.stop();
			return;
		}
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (err) {
			error = {
				NotAllowedError: 'Microphone access is blocked. Allow it in the browser’s site settings (and the browser’s app permissions on Android).',
				NotFoundError: 'No microphone was found',
				NotReadableError: 'The microphone is in use by another app',
			}[err?.name] || `Could not open the microphone (${err?.name || err})`;
			return;
		}
		const chunks = [];
		recorder = new MediaRecorder(stream);
		recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
		recorder.onstop = async () => {
			stream.getTracks().forEach(t => t.stop());
			recording = false;
			transcribing = true;
			try {
				const res = await fetch('/api/transcribe', {
					method: 'POST',
					headers: { 'Content-Type': recorder.mimeType || 'audio/webm' },
					body: new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error);
				const text = (data.text || '').trim();
				if (text) await submit(text);
			} catch (err) {
				error = err.message || 'Could not understand the recording';
			}
			transcribing = false;
		};
		recorder.start();
		recording = true;
		error = null;
	}
</script>

<form class="composer" on:submit|preventDefault={() => submit()}>
	<input
		class="text"
		type="text"
		bind:value={input}
		placeholder={recording ? 'Listening… tap the mic to stop' : transcribing ? 'Transcribing…' : placeholder}
		disabled={sending || recording || transcribing}
		maxlength="2000"
		aria-label="Message the assistant"
	/>
	{#if canRecord}
		<button type="button" class="icon" class:recording on:click={toggleRecording}
			disabled={sending || transcribing} aria-label={recording ? 'Stop recording' : 'Speak'} aria-pressed={recording}>
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
				<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
				<path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
			</svg>
		</button>
	{/if}
	<button type="submit" class="icon send" disabled={sending || !input.trim()} aria-label="Send">
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<path d="M4 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>
</form>
{#if error}
	<p class="input-error" role="alert">{error}</p>
{/if}

<style>
	/* Moved unchanged from AssistantChat.svelte (composer section) */
	.composer { display: flex; gap: var(--space-xs); align-items: stretch; }
	.text {
		flex: 1; min-width: 0; min-height: var(--control-min-h);
		padding: var(--control-pad-y) var(--control-pad-x);
		border: var(--bw) solid var(--primary); border-radius: var(--radius-pill);
		background: var(--paper); color: var(--ink); font: inherit; transition: var(--swap);
	}
	.text::placeholder { color: var(--muted); }
	.text:focus { outline: none; border-color: var(--primary-deep); box-shadow: var(--focus-ring); }
	.text:disabled { opacity: 0.7; }
	.icon {
		flex-shrink: 0; width: var(--control-min-h); height: var(--control-min-h);
		display: grid; place-items: center; border-radius: var(--radius-circle);
		border: var(--bw) solid var(--primary); background: var(--paper); color: var(--primary);
		cursor: pointer; transition: var(--swap);
	}
	.icon:hover:not(:disabled) { background: var(--paper-shade); }
	.icon:active:not(:disabled) { transform: scale(0.94); }
	.icon:disabled { border-color: var(--idle); color: var(--idle); cursor: default; }
	.icon.send:not(:disabled) { background: var(--primary); color: var(--paper); }
	.icon.send:hover:not(:disabled) { background: var(--primary-deep); }
	.icon.recording {
		background: var(--urgent); border-color: var(--urgent); color: var(--paper);
		animation: pulse 1.4s var(--ease-in-out) infinite;
	}
	@keyframes pulse { 50% { box-shadow: 0 0 0 6px var(--urgent-a12); } }
	@media (prefers-reduced-motion: reduce) { .icon.recording { animation: none; } }
	.input-error { margin: var(--space-xs) 0 0; color: var(--urgent); font-size: var(--text-sm); }
</style>
```

- [ ] **Step 2: `AssistantThread.svelte`** (message list, status lines, plan review; the bubble/plan/action styles move here unchanged from `AssistantChat.svelte`)

```svelte
<script>
	import { tick } from 'svelte';
	import { reveal } from '$lib/motion';
	import { cancel, togglePlanAction, confirm, reject } from '$lib/assistant/store.js';

	export let conversationId = null;
	export let messages = [];
	export let onAskAgain = () => {};
	export let maxHeight = 'min(55vh, 480px)';

	let log;
	let planError = {};
	const STATUS = { done: '✓', failed: '✕', skipped: '–', not_run: '–' };

	$: messages, scrollDown();
	async function scrollDown() {
		await tick();
		if (log) log.scrollTop = log.scrollHeight;
	}

	function questionBefore(i) {
		for (let j = i - 1; j >= 0; j--) if (messages[j].role === 'user') return messages[j].content;
		return '';
	}

	const waiting = (m) => (m.ahead == null ? 'Waiting…' : m.ahead === 0 ? 'Starting…' : `Waiting — ${m.ahead} ahead of you`);
	const ended = { cancelled: 'Cancelled', interrupted: null, error: null };

	async function doConfirm(m) {
		const r = await confirm(conversationId, m._id);
		planError = { ...planError, [m._id]: r.error || null };
	}
	async function doReject(m) {
		const r = await reject(conversationId, m._id);
		planError = { ...planError, [m._id]: r.error || null };
	}
</script>

<div class="log" bind:this={log} style:max-height={maxHeight}>
	{#each messages as m, i (m._id)}
		<div class="msg {m.role}" in:reveal>
			{#if m.content}
				<p class="bubble">{m.content}</p>
			{:else if m.role === 'assistant' && m.status === 'running' && !m.tools?.length}
				<p class="bubble thinking" aria-live="polite">Thinking…</p>
			{/if}

			{#if m.role === 'assistant' && m.status === 'running' && m.tools?.length}
				<ul class="chips" aria-label="Steps">
					{#each m.tools as t}
						<li class="chip" class:failed={t.error}>{t.summary || t.name.replaceAll('_', ' ')}</li>
					{/each}
				</ul>
			{/if}

			{#if m.role === 'assistant' && m.status === 'queued'}
				<p class="status" aria-live="polite">
					<span>{waiting(m)}</span>
					<button class="link" on:click={() => cancel(conversationId, m._id)}>Cancel</button>
				</p>
			{:else if m.role === 'assistant' && m.status === 'running'}
				<p class="status">
					<button class="link" on:click={() => cancel(conversationId, m._id)}>Stop</button>
				</p>
			{/if}

			{#if m.doneActions?.length}
				<ul class="actions">
					{#each m.doneActions as a}
						<li class="action done"><span class="mark">✓</span>{a.summary}</li>
					{/each}
				</ul>
			{/if}

			{#if m.plan}
				<div class="plan" class:settled={m.plan.state !== 'review'}>
					<p class="plan-title">
						{#if m.plan.state === 'review'}Review before I go ahead{:else if m.plan.state === 'running'}Working…{:else if m.plan.state === 'rejected'}Rejected{:else}Result{/if}
					</p>
					<ul class="actions">
						{#each m.plan.actions as a (a.ref)}
							<li class="action" class:failed={a.status === 'failed'} class:skipped={a.status === 'skipped' || a.status === 'not_run'}>
								{#if m.plan.state === 'review'}
									<label>
										<input type="checkbox" checked={a.checked} on:change={() => togglePlanAction(conversationId, m._id, a.ref)} />
										<span>{a.summary}</span>
									</label>
								{:else}
									<span class="mark">{a.status ? STATUS[a.status] : '·'}</span>
									<span>{a.summary}{#if a.error}<span class="err"> — {a.error}</span>{/if}</span>
								{/if}
							</li>
						{/each}
					</ul>
					{#if m.plan.state === 'review'}
						<div class="plan-buttons">
							<button class="btn primary" on:click={() => doConfirm(m)}>
								{m.plan.actions.every(a => a.checked) ? 'Do it' : `Do ${m.plan.actions.filter(a => a.checked).length} selected`}
							</button>
							<button class="btn" on:click={() => doReject(m)}>Cancel</button>
						</div>
					{/if}
					{#if planError[m._id]}<p class="err">{planError[m._id]}</p>{/if}
				</div>
			{/if}

			{#if m.role === 'assistant' && ['error', 'interrupted', 'cancelled'].includes(m.status)}
				<p class="bubble error">
					{m.error || ended[m.status] || 'Something went wrong'}
					{#if questionBefore(i)}
						<button class="link" on:click={() => onAskAgain(questionBefore(i))}>Ask again</button>
					{/if}
				</p>
			{/if}
		</div>
	{/each}
</div>

<style>
	/* Conversation, actions and review list: moved unchanged from AssistantChat.svelte */
	.log { display: flex; flex-direction: column; gap: var(--space-sm); overflow-y: auto; overscroll-behavior: contain; padding: 2px; }
	.msg { display: flex; flex-direction: column; gap: var(--space-xs); max-width: min(100%, var(--measure)); }
	.msg.user { align-self: flex-end; align-items: flex-end; }
	.msg.assistant { align-self: flex-start; }
	.bubble {
		margin: 0; padding: var(--control-pad-y) var(--control-pad-x); border-radius: var(--radius-lg);
		font-size: var(--text-base); line-height: var(--leading-body); white-space: pre-wrap; overflow-wrap: anywhere;
	}
	.user .bubble { background: var(--primary); color: var(--paper); border-bottom-right-radius: var(--radius-sm); }
	.assistant .bubble {
		background: var(--primary-a08); color: var(--ink);
		border: var(--bw-hair) solid var(--primary-a25); border-bottom-left-radius: var(--radius-sm);
	}
	.bubble.thinking { color: var(--primary); font-style: italic; }
	.bubble.error { background: var(--urgent-a12); border-color: transparent; color: var(--urgent); font-size: var(--text-sm); }
	.status { margin: 0; display: flex; gap: var(--space-sm); align-items: baseline; font-size: var(--text-sm); color: var(--muted); }
	.chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-xs); }
	.chip {
		font-size: var(--text-xs); color: var(--primary); border: var(--bw-hair) solid var(--primary-a25);
		border-radius: var(--radius-pill); padding: 1px var(--space-sm);
	}
	.chip.failed { color: var(--urgent); }
	.link {
		background: none; border: none; padding: 0; color: var(--primary); font: inherit;
		font-size: var(--text-sm); text-decoration: underline; cursor: pointer;
	}
	.bubble.error .link { margin-left: var(--space-sm); color: inherit; }
	.plan {
		border: var(--bw) solid var(--primary); border-radius: var(--radius-lg);
		padding: var(--space-sm) var(--space-md); background: var(--paper); transition: var(--swap);
	}
	.plan.settled { border-color: var(--primary-a25); }
	.plan-title { margin: 0 0 var(--space-xs); font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--primary); }
	.actions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
	.action {
		display: flex; gap: var(--space-sm); align-items: baseline; font-size: var(--text-sm);
		line-height: var(--leading-snug); color: var(--ink); padding: 3px 0;
	}
	.action label { display: flex; gap: var(--space-sm); align-items: baseline; cursor: pointer; }
	.action input { accent-color: var(--primary); flex-shrink: 0; }
	.action .mark { width: 1ch; flex-shrink: 0; font-weight: var(--weight-bold); color: var(--ok); }
	.action.failed .mark, .action .err, .err { color: var(--urgent); }
	.action.skipped, .action.skipped .mark { color: var(--muted); }
	.actions > .action.done { color: var(--primary); }
	.plan-buttons { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); flex-wrap: wrap; }
	.btn {
		min-height: var(--control-min-h); padding: var(--control-pad-y) var(--control-pad-x);
		border-radius: var(--radius-md); border: var(--bw) solid var(--primary); background: var(--paper);
		color: var(--primary); font: inherit; font-weight: var(--weight-bold); cursor: pointer; transition: var(--swap);
	}
	.btn:hover { background: var(--paper-shade); }
	.btn.primary { background: var(--primary); color: var(--paper); }
	.btn.primary:hover { background: var(--primary-deep); }
	.btn:active { transform: scale(0.97); }
</style>
```

- [ ] **Step 3: Rewrite the home panel `AssistantChat.svelte`**

```svelte
<script>
	import { onMount } from 'svelte';
	import { expand } from '$lib/motion';
	import AssistantThread from '$lib/assistant/AssistantThread.svelte';
	import AssistantInput from '$lib/assistant/AssistantInput.svelte';
	import { conversations, threads, listLoaded, open, send, setVisible, selected, onHouseholdChange } from '$lib/assistant/store.js';

	// Called after the assistant changed something, so the page can reload
	export let onChange = () => {};
	// Home is on screen: its conversation counts as read when answers arrive
	export let active = true;

	// Follows the member's latest conversation until they start a new one
	let followLatest = true;
	let current = null;
	let requested = null; // loads each conversation once, even if it 404s (deleted elsewhere)

	$: if (followLatest && $listLoaded) current = $conversations[0]?._id ?? null;
	$: if (current && current !== requested && !$threads[current]) { requested = current; open(current, { read: active }); }
	$: setVisible('home', active ? current : null);
	$: messages = (current && $threads[current]) || [];

	onMount(() => onHouseholdChange(() => onChange()));

	function newChat() {
		followLatest = false;
		current = null;
	}

	async function onSend(text) {
		const r = await send(text, current);
		if (r.error) return r;
		current = r.conversationId;
		followLatest = true;
		return {};
	}

	function allChats() {
		selected.set(current);
		window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: 'assistant' }));
	}
</script>

<div class="assistant">
	<div class="bar">
		<button class="link" on:click={newChat} disabled={!current}>New</button>
		<button class="link" on:click={allChats}>All chats →</button>
	</div>
	{#if messages.length}
		<div transition:expand>
			<AssistantThread conversationId={current} {messages} onAskAgain={onSend} />
		</div>
	{/if}
	<AssistantInput {onSend} />
</div>

<style>
	.assistant { display: flex; flex-direction: column; gap: var(--space-sm); }
	.bar { display: flex; justify-content: flex-end; gap: var(--space-md); }
	.link {
		background: none; border: none; padding: 0; color: var(--primary); font: inherit;
		font-size: var(--text-xs); text-decoration: underline; cursor: pointer;
	}
	.link:disabled { color: var(--idle); cursor: default; text-decoration: none; }
</style>
```

- [ ] **Step 4: Pass `active` from home**

In `frontend/src/lib/menus/home/home.svelte` change line 794:

```svelte
			<AssistantChat onChange={loadData} />
```

to

```svelte
			<AssistantChat onChange={loadData} {active} />
```

- [ ] **Step 5: Let `viewModeChanged` take a page name**

In `frontend/src/routes/+page.svelte`, inside `onMount`, replace:

```js
			window.addEventListener("viewModeChanged", (event) => {
				if (event.detail !== undefined) {
					updateViewMode(event.detail);
				}
			});
```

with:

```js
			// detail: a page index, or a page name ("assistant")
			window.addEventListener("viewModeChanged", (event) => {
				const target = typeof event.detail === "string" ? pages[event.detail] : event.detail;
				if (target !== undefined) {
					updateViewMode(target);
				}
			});
```

- [ ] **Step 6: Build check**

Run: `cd /mnt/storage/home/it/home_calendar/frontend && npm run build 2>&1 | grep -E "error|warn|built|Wrote" | head -20`
Expected: build succeeds; no new errors. Svelte a11y warnings, if any, must not come from the three new/changed files (fix them if they do).

- [ ] **Step 7: Commit**

```bash
cd /mnt/storage/home/it/home_calendar
git add frontend/src/lib/assistant/AssistantThread.svelte frontend/src/lib/assistant/AssistantInput.svelte frontend/src/lib/components/AssistantChat.svelte frontend/src/lib/menus/home/home.svelte frontend/src/routes/+page.svelte
git commit -m "feat(frontend): home assistant panel on stored conversations"
```

---

## Task 10: Assistant tab, nav badge, store connection, docs

**Files:**
- Create: `frontend/src/lib/menus/assistant/assistant.svelte`
- Modify: `frontend/src/params/view.js` (add `'assistant'`)
- Modify: `frontend/src/routes/+page.svelte` (page index, `pageNames`, `TABS`, `Screen`, nav entry + badge, store `connect`)
- Modify: `frontend/src/lib/header/navButton.svelte` (badges)
- Modify: `CLAUDE.md` (Assistant paragraph)

**Interfaces:**
- Consumes: store (Task 8), `AssistantThread`, `AssistantInput` (Task 9), `Screen` contract (`active`, `onReady`).
- Produces: view `assistant` reachable at `/assistant`; `NavButton` prop `badges` (`{ [label]: number }`).

- [ ] **Step 1: The Assistant tab**

`frontend/src/lib/menus/assistant/assistant.svelte`:

```svelte
<script>
	import AssistantThread from '$lib/assistant/AssistantThread.svelte';
	import AssistantInput from '$lib/assistant/AssistantInput.svelte';
	import { conversations, threads, listLoaded, open, send, remove, setVisible, selected } from '$lib/assistant/store.js';

	export let active = true;
	export let onReady = () => {};

	let current = null;      // open conversation, null = new chat
	let showList = true;     // phones: list or conversation
	let error = null;
	let reported = false;

	$: if ($listLoaded && !reported) { reported = true; onReady(); }
	$: if (active && $selected !== undefined) { pick($selected); selected.set(undefined); }
	$: setVisible('tab', active ? current : null);
	$: messages = (current && $threads[current]) || [];
	$: title = current ? ($conversations.find(c => c._id === current)?.title ?? '') : 'New chat';

	async function pick(id) {
		current = id;
		showList = !id;
		error = null;
		if (id) await open(id);
	}

	function newChat() {
		current = null;
		showList = false;
		error = null;
	}

	async function onSend(text) {
		const r = await send(text, current);
		if (r.error) return r;
		current = r.conversationId;
		return {};
	}

	async function del(id) {
		if (!window.confirm('Delete this conversation?')) return;
		const r = await remove(id);
		if (r.error) { error = r.error; return; }
		if (current === id) { current = null; showList = true; }
	}

	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	function ago(date) {
		const s = (new Date(date).getTime() - Date.now()) / 1000;
		const steps = [[60, 'second'], [3600, 'minute'], [86400, 'hour'], [604800, 'day'], [Infinity, 'week']];
		const sizes = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 };
		const [, unit] = steps.find(([limit]) => Math.abs(s) < limit);
		return rtf.format(Math.round(s / sizes[unit]), unit);
	}
</script>

<div class="assistant-tab" class:show-list={showList}>
	<aside class="list" aria-label="Conversations">
		<button class="btn primary new" on:click={newChat}>New chat</button>
		{#if error}<p class="err" role="alert">{error}</p>{/if}
		<ul>
			{#each $conversations as c (c._id)}
				<li class:current={c._id === current}>
					<button class="row" on:click={() => pick(c._id)}>
						<span class="title">{c.title}</span>
						<span class="meta">
							{#if c.busy}<span class="busy">answering…</span>{/if}
							<time datetime={c.updatedAt}>{ago(c.updatedAt)}</time>
							{#if c.unread}<span class="dot" aria-label="Unread"></span>{/if}
						</span>
					</button>
					<button class="link del" on:click={() => del(c._id)} aria-label={`Delete ${c.title}`}>Delete</button>
				</li>
			{:else}
				{#if $listLoaded}<li class="empty">No conversations yet</li>{/if}
			{/each}
		</ul>
	</aside>

	<section class="conversation" aria-label={title}>
		<div class="head">
			<button class="link back" on:click={() => (showList = true)}>← Chats</button>
			<h2>{title}</h2>
		</div>
		{#if messages.length}
			<AssistantThread conversationId={current} {messages} onAskAgain={onSend} maxHeight="none" />
		{:else}
			<p class="hint">Ask anything about the calendar, chores and todos, or tell me what you did.</p>
		{/if}
		<AssistantInput {onSend} />
	</section>
</div>

<style>
	.assistant-tab {
		display: grid;
		grid-template-columns: minmax(14rem, 18rem) 1fr;
		gap: var(--space-lg);
		align-items: start;
	}
	.list ul { list-style: none; margin: var(--space-sm) 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
	.list li { display: flex; align-items: center; gap: var(--space-xs); border-radius: var(--radius-md); }
	.list li.current { background: var(--primary-a08); }
	.row {
		flex: 1; min-width: 0; text-align: left; background: none; border: none; cursor: pointer;
		padding: var(--space-xs) var(--space-sm); font: inherit; color: var(--ink);
		display: flex; flex-direction: column; gap: 2px;
	}
	.title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: var(--weight-bold); }
	.meta { display: flex; gap: var(--space-xs); align-items: center; font-size: var(--text-xs); color: var(--muted); }
	.busy { color: var(--primary); }
	.dot { width: 8px; height: 8px; border-radius: var(--radius-circle); background: var(--primary); }
	.empty, .hint { color: var(--muted); font-size: var(--text-sm); }
	.conversation { display: flex; flex-direction: column; gap: var(--space-sm); min-width: 0; }
	.head { display: flex; align-items: baseline; gap: var(--space-sm); }
	.head h2 { margin: 0; font-size: var(--text-lg); color: var(--primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.back { display: none; }
	.link {
		background: none; border: none; padding: 0; color: var(--primary); font: inherit;
		font-size: var(--text-xs); text-decoration: underline; cursor: pointer;
	}
	.del { color: var(--muted); padding: 0 var(--space-xs); }
	.err { color: var(--urgent); font-size: var(--text-sm); }
	.btn {
		min-height: var(--control-min-h); padding: var(--control-pad-y) var(--control-pad-x);
		border-radius: var(--radius-md); border: var(--bw) solid var(--primary);
		font: inherit; font-weight: var(--weight-bold); cursor: pointer; transition: var(--swap);
	}
	.btn.primary { background: var(--primary); color: var(--paper); width: 100%; }
	.btn.primary:hover { background: var(--primary-deep); }

	/* Phones: one pane at a time */
	@media (max-width: 720px) {
		.assistant-tab { grid-template-columns: 1fr; }
		.assistant-tab.show-list .conversation { display: none; }
		.assistant-tab:not(.show-list) .list { display: none; }
		.back { display: inline; }
	}
</style>
```

- [ ] **Step 2: Register the view**

`frontend/src/params/view.js`, `VIEWS` becomes:

```js
const VIEWS = ['home', 'calendar', 'chores', 'addEvent', 'addChore', 'settings', 'todo', 'stats', 'addTodo', 'automations', 'addAutomation', 'assistant'];
```

In `frontend/src/routes/+page.svelte`:

1. Imports, add:
```js
	import AssistantTab from "$lib/menus/assistant/assistant.svelte";
	import { connect, unreadCount } from "$lib/assistant/store.js";
```
2. `pages`: add `assistant: 11,` after `addAutomation: 10,`.
3. `pageNames`: append `"assistant",` after `"addAutomation",`.
4. `TABS`: `const TABS = ["home", "assistant", "calendar", "chores", "todo", "stats", "automations", "settings"];`
5. After `$: view = pageNames[viewMode];` add:
```js
	// One assistant stream per page, for the member picked on this device
	$: if (browser && user && !loading) connect(user);
```
(`browser` is imported further down in the same script; Svelte hoists imports, so this is fine.)
6. In the `<main class="screens">` block, right after the home `Screen` block, add:
```svelte
		{#if alive.assistant || view === "assistant"}
			<Screen name="assistant" active={view === "assistant"}>
				<AssistantTab active={view === "assistant"} onReady={() => markReady("assistant")} />
			</Screen>
		{/if}
```
7. `NavButton`: buttons and mask become:
```svelte
<NavButton
	active={viewMode}
	f={updateViewMode}
	buttons={{
		home: pages.home,
		assistant: pages.assistant,
		calendar: pages.calendar,
		chores: pages.chores,
		todo: pages.todo,
		stats: pages.stats,
		automations: pages.automations,
		settings: pages.settings,
	}}
	badges={{ assistant: $unreadCount }}
	disableMask={[false, false, false, false, false, false, false, false]}
/>
```

- [ ] **Step 3: Nav badges**

In `frontend/src/lib/header/navButton.svelte` add the prop after `disableMask`:

```js
	// Count bubbles per button label, e.g. { assistant: 2 }; 0 hides it
	export let badges = {};
```

Replace the button line inside `{#each}` with:

```svelte
	        <button disabled={masked} class="navButton {active == button[1]? 'active' : ''}" aria-current={active == button[1] ? 'page' : undefined} on:click={() => f(button[1])}>{button[0]}{#if badges[button[0]]}<span class="badge" aria-label={`${badges[button[0]]} unread`}>{badges[button[0]]}</span>{/if}</button>
```

Add to the `<style>` block:

```css
	.navButton { position: relative; }

	.badge {
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		box-sizing: border-box;
		border-radius: var(--radius-pill);
		background: var(--urgent);
		color: var(--paper);
		font-size: var(--text-xs);
		line-height: 18px;
		text-align: center;
	}
```

Update the comment in the 480px media query from "The seven labels" to "The eight labels" (the under-360px grid of four columns already fits eight as two rows).

- [ ] **Step 4: Update `CLAUDE.md`**

In the **Assistant** paragraph of `CLAUDE.md`, replace the sentence starting "`backend/assistant.js` runs the agent loop (SSE)" with:

```markdown
`backend/assistant.js` runs the agent loop and the routes; every model prompt (chat and automations) goes through one durable queue (`assistantQueue.js`, Mongo store `assistantJobs.js`, collection `assistant_jobs`): one job at a time, chat before automations, restart requeues automations and marks chat questions interrupted. Chat questions are stored in `assistant_conversations`/`assistant_messages` (`assistantConversations.js`, private per member), answered by `assistantChatJob.js`, and streamed to the member's pages over `GET /assistant/events` (`assistantEvents.js`). The frontend keeps one stream per page in `lib/assistant/store.js`; the home panel shows the latest conversation and the Assistant tab lists them all. The backend must run as a single replica (one worker). `backend/assistantTools.js` defines the tools;
```

and replace "staged and returned as a review list, run later by `POST /assistant/confirm` without the model" with "staged and stored as a review list on the answer, run later (no expiry) by `POST /assistant/confirm` without the model".

- [ ] **Step 5: Build check**

Run: `cd /mnt/storage/home/it/home_calendar/frontend && npm run build 2>&1 | grep -E "error|built|Wrote" | head`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
cd /mnt/storage/home/it/home_calendar
git add frontend/src/lib/menus/assistant/assistant.svelte frontend/src/params/view.js frontend/src/routes/+page.svelte frontend/src/lib/header/navButton.svelte CLAUDE.md
git commit -m "feat(frontend): Assistant tab with conversation list and unread badge"
```

---

## Task 11: Deploy to k3s and verify end to end

**Files:**
- Modify: `/home/xed/k3s/home-calendar/calendar.yaml` (image tags only; separate git repo `~/k3s`)

- [ ] **Step 1: Full test run**

```bash
cd /mnt/storage/home/it/home_calendar
MONGO_TEST_URI=mongodb://127.0.0.1:27099/assistant_test npm --prefix backend test 2>&1 | tail -8
```

Expected: `# fail 0`, `# skipped 0`.

- [ ] **Step 2: Build and push images**

```bash
cd /mnt/storage/home/it/home_calendar
TAG=$(git rev-parse --short HEAD)
docker build -q -t 127.0.0.1:30500/calendar-backend:$TAG backend && docker push -q 127.0.0.1:30500/calendar-backend:$TAG
docker build -q -t 127.0.0.1:30500/calendar-frontend:$TAG frontend && docker push -q 127.0.0.1:30500/calendar-frontend:$TAG
echo $TAG
```

Expected: two `127.0.0.1:30500/...:<TAG>` lines, no errors.

- [ ] **Step 3: Deploy**

Read `/home/xed/k3s/home-calendar/calendar.yaml` first (it was edited outside this plan). Change only the two `image:` lines to the new `<TAG>`, confirm the backend Deployment still has `replicas: 1` and `strategy: type: Recreate`, then:

```bash
export KUBECONFIG=$HOME/.kube/config
kubectl apply -f /home/xed/k3s/home-calendar/calendar.yaml
kubectl -n home-calendar rollout status deploy/backend --timeout=180s
kubectl -n home-calendar rollout status deploy/frontend --timeout=180s
kubectl -n home-calendar logs deploy/backend --tail=20
```

Expected: both rollouts succeed; backend log shows `Connected to MongoDB` and `Server running`, no stack traces.

- [ ] **Step 4: Automations through the queue**

In the app (https://home.kooka-tarpon.ts.net:4443), Automations tab → **Run now** on one automation. Expected: the run shows as running, then a new result appears (or the same "stopped after too many steps" the AH automation had before: that one is out of scope). Backend log: no `exclusive` errors.

- [ ] **Step 5: Manual checklist with the human partner** (each line: do it, confirm the expected result)

- Ask a question while an automation runs → reply shows `Waiting — 1 ahead of you`, then streams.
- Ask, close the tab while it waits, reopen later → answer is there; unread dot + nav badge; both clear when the conversation is opened.
- Ask something that stages changes, then `kubectl -n home-calendar rollout restart deploy/backend`, reopen → review list still there; **Do it** runs once (double-click shows the result, not a second run).
- **Stop** a running answer (partial text kept, "Cancelled"); **Cancel** a queued one; **Ask again** after an error.
- Two tabs, same member: confirm a plan in one → the other shows the result without reload.
- Switch member on home → list and answers switch to that member; the other member's conversations are not listed.
- Assistant tab on a phone: list full screen → tap → conversation → **← Chats** back.
- Open and close the app tab 5 times, then: `kubectl -n home-calendar logs deploy/backend | grep "Assistant stream" | tail -3` → the last `closed (N open)` count returns to the number of tabs still open (no leak).

- [ ] **Step 6: Commit the deployment change and stop the test Mongo**

```bash
cd /home/xed/k3s && git add home-calendar/calendar.yaml && git commit -m "Deploy home-calendar assistant queue (<TAG>)"
docker stop assistant-test-mongo
```

- [ ] **Step 7: Hand back to the human partner** with the branch name `assistant-queue`, the test summary, the checklist results, and the open choice of merging the branch (superpowers:finishing-a-development-branch).
