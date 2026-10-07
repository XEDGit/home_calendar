// One model job at a time for the whole backend: the GPU fits one context.
// Jobs live in a store (Mongo in production, memory in tests) so a question
// survives a closed tab or a restart. Chat jobs go before automations; a
// running job is never interrupted except by its own cancel or timeout.

export const PRIORITY = { chat: 0, automation: 1 };
export const MAX_ACTIVE_PER_MEMBER = 5;
export const RUN_TIMEOUT_MS = 5 * 60 * 1000;
// After abort, how long the worker waits for a handler to wind down (save
// partial output) before moving on. A handler that ignores its signal must
// not freeze the queue.
export const ABORT_GRACE_MS = 10 * 1000;
const GRACE_EXPIRED = Symbol('grace expired');

export function createQueue({ store, timeoutMs = RUN_TIMEOUT_MS, graceMs = ABORT_GRACE_MS, onPositions = () => {}, log = console }) {
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
		const abortStatus = () => (ctl.signal.reason === 'cancelled' ? 'cancelled' : 'error');
		let graceTimer = null;
		let status = 'done';
		try {
			const handler = handlers[job.kind];
			if (!handler) throw new Error(`no handler for ${job.kind}`);
			// Once aborted, the handler gets graceMs to wind down; then the worker moves on.
			// A job cancelled before start still reaches its handler, already aborted.
			const grace = new Promise((resolve) => {
				const start = () => { graceTimer = setTimeout(() => resolve(GRACE_EXPIRED), graceMs); };
				if (ctl.signal.aborted) start();
				else ctl.signal.addEventListener('abort', start, { once: true });
			});
			const outcome = await Promise.race([handler(job, { signal: ctl.signal }), grace]);
			if (outcome === GRACE_EXPIRED) {
				log.error(`Assistant job ${id} (${job.kind}) did not stop within ${graceMs} ms after ${ctl.signal.reason}; moving on`);
				status = abortStatus();
			} else if (ctl.signal.aborted) {
				status = abortStatus();
			}
		} catch (err) {
			status = abortStatus();
			if (status === 'error') log.error(`Assistant job ${id} (${job.kind}) failed:`, err);
		} finally {
			clearTimeout(timer);
			clearTimeout(graceTimer);
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
