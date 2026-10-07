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
