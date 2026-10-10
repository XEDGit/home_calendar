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

	// Opens at the latest message and follows new ones, unless the member has
	// scrolled up to read: then the log stays where they are.
	let atBottom = true;
	let shown = null;
	$: if (conversationId !== shown) { shown = conversationId; atBottom = true; }
	$: messages, scrollDown();
	async function scrollDown() {
		await tick();
		if (log && atBottom) log.scrollTop = log.scrollHeight;
	}
	// A scroll event that arrives with a new size came from layout (the log or
	// its content resized), not from the member: stay pinned through it.
	let size = '';
	function onScroll() {
		const now = `${log.scrollHeight}x${log.clientHeight}`;
		if (now !== size && atBottom) { size = now; log.scrollTop = log.scrollHeight; return; }
		size = now;
		atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
	}
	// Heights keep changing after a render: the log itself (screen resize, the
	// tab measuring itself) and the messages in it (fonts arriving, entrance
	// animations, a review card settling). Keep the latest message in view
	// through all of it while the member is at the bottom.
	function followResize(node) {
		const ro = new ResizeObserver(() => { if (atBottom) node.scrollTop = node.scrollHeight; });
		const watch = () => { ro.disconnect(); ro.observe(node); for (const c of node.children) ro.observe(c); };
		const mo = new MutationObserver(watch);
		mo.observe(node, { childList: true });
		watch();
		return { destroy: () => { mo.disconnect(); ro.disconnect(); } };
	}

	function questionBefore(i) {
		for (let j = i - 1; j >= 0; j--) if (messages[j].role === 'user') return messages[j].content;
		return '';
	}

	let retrying = null; // id of the message whose "Ask again" is in flight
	let retryError = {};

	async function askAgain(m, question) {
		if (retrying) return;
		retrying = m._id;
		retryError = { ...retryError, [m._id]: null };
		const r = await onAskAgain(question);
		retrying = null;
		if (r?.error) retryError = { ...retryError, [m._id]: r.error };
	}

	const waiting = (m) => (m.ahead == null ? 'Waiting…' : m.ahead === 0 ? 'Starting…' : `Waiting — ${m.ahead} ahead of you`);
	// Finished without saying anything or proposing anything
	const empty = (m) => m.role === 'assistant' && m.status === 'done' && !m.content && !m.plan && !m.doneActions?.length;
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

<div class="log" bind:this={log} use:followResize on:scroll={onScroll} style:max-height={maxHeight}>
	{#each messages as m, i (m._id)}
		<div class="msg {m.role}" in:reveal>
			{#if m.content}
				<p class="bubble">{m.content}</p>
			{:else if m.role === 'assistant' && m.status === 'running' && !m.tools?.length}
				<p class="bubble thinking" aria-live="polite">Thinking…</p>
			{/if}

			{#if m.role === 'assistant' && m.status === 'running' && m.tools?.length}
				<ul class="steps" aria-label="Steps" aria-live="polite">
					{#each m.tools as t, ti}
						<li class="step" class:failed={t.error} class:now={ti === m.tools.length - 1}>
							<span class="mark" aria-hidden="true">{t.error ? '✕' : ti === m.tools.length - 1 ? '' : '✓'}</span>
							{t.summary || t.name.replaceAll('_', ' ')}
						</li>
					{/each}
				</ul>
			{/if}

			{#if m.role === 'assistant' && m.status === 'queued'}
				<p class="status" aria-live="polite">
					<span>{waiting(m)}</span>
					<button class="small-btn" on:click={() => cancel(conversationId, m._id)}>Cancel</button>
				</p>
			{:else if m.role === 'assistant' && m.status === 'running'}
				<p class="status">
					<button class="small-btn" on:click={() => cancel(conversationId, m._id)}>Stop</button>
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
						{#if m.plan.state === 'review'}Review before I go ahead{:else if m.plan.state === 'running'}Working…{:else if m.plan.state === 'rejected'}Rejected{:else if m.plan.state === 'interrupted'}Stopped by a restart — some changes may have been made{:else}Result{/if}
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
						{@const picked = m.plan.actions.filter(a => a.checked).length}
						<div class="plan-buttons">
							<button class="btn btn-solid" disabled={!picked} on:click={() => doConfirm(m)}>
								{picked === m.plan.actions.length ? 'Do it' : picked ? `Do ${picked} of ${m.plan.actions.length}` : 'Nothing selected'}
							</button>
							<button class="btn btn-ghost" on:click={() => doReject(m)}>Cancel</button>
						</div>
					{/if}
					{#if planError[m._id]}<p class="err">{planError[m._id]}</p>{/if}
				</div>
			{/if}

			{#if m.role === 'assistant' && (['error', 'interrupted', 'cancelled'].includes(m.status) || empty(m))}
				<p class="bubble error">
					{m.error || ended[m.status] || (empty(m) ? "I couldn't finish this one" : 'Something went wrong')}
					{#if questionBefore(i)}
						<button class="small-btn" disabled={retrying !== null} on:click={() => askAgain(m, questionBefore(i))}>Ask again</button>
					{/if}
				</p>
				{#if retryError[m._id]}<p class="err" role="alert">{retryError[m._id]}</p>{/if}
			{/if}
		</div>
	{/each}
</div>

<style>
	.log { display: flex; flex-direction: column; gap: var(--space-sm); overflow-y: auto; overscroll-behavior: contain; padding: 2px; }
	.msg { display: flex; flex-direction: column; gap: var(--space-xs); max-width: min(100%, var(--measure)); }
	/* The member's words sit in rose on the right; the answer reads as plain
	 * text on the page, like a printed entry, and takes the full column */
	.msg.user { align-self: flex-end; align-items: flex-end; max-width: min(85%, var(--measure)); }
	.msg.assistant { align-self: stretch; }
	.bubble {
		margin: 0; font-size: var(--text-base); line-height: var(--leading-body);
		white-space: pre-wrap; overflow-wrap: break-word; text-wrap: pretty;
	}
	.user .bubble {
		padding: var(--control-pad-y) var(--control-pad-x); border-radius: var(--radius-lg);
		border-bottom-right-radius: var(--radius-sm); background: var(--primary); color: var(--paper);
	}
	.assistant .bubble { color: var(--ink); max-width: var(--measure); }
	.bubble.thinking { color: var(--primary); font-style: italic; }
	.bubble.error {
		display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-xs) var(--space-sm);
		padding: var(--control-pad-y) var(--control-pad-x); border-radius: var(--radius-lg);
		background: var(--urgent-a12); color: var(--urgent); font-size: var(--text-sm);
	}
	.status { margin: 0; display: flex; flex-wrap: wrap; gap: var(--space-sm); align-items: center; font-size: var(--text-sm); color: var(--primary); font-style: italic; }

	/* What the assistant is doing right now: done steps ticked, the current
	 * one pulsing. Not .chip: the global filter chip would restyle these. */
	.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
	.step {
		display: flex; gap: var(--space-sm); align-items: baseline;
		font-size: var(--text-sm); line-height: var(--leading-snug); color: var(--primary);
	}
	.step .mark { width: 1ch; flex-shrink: 0; font-weight: var(--weight-bold); }
	.step.now { font-style: italic; }
	.step.now .mark::before {
		content: ''; display: inline-block; width: 7px; height: 7px; border-radius: var(--radius-circle);
		background: currentColor; animation: working 1.2s var(--ease-in-out) infinite;
	}
	@keyframes working { 50% { opacity: 0.25; } }
	.step.failed { color: var(--urgent); }

	/* Stop, Cancel, Ask again: compact pills, quiet until hovered */
	.small-btn {
		flex-shrink: 0; padding: 2px var(--space-sm); border: var(--bw) solid currentColor; border-radius: var(--radius-pill);
		background: none; color: inherit; font: inherit; font-style: normal; font-size: var(--text-sm);
		font-weight: var(--weight-bold); white-space: nowrap; cursor: pointer; transition: var(--swap);
	}
	.status .small-btn { color: var(--primary); }
	.small-btn:disabled { opacity: 0.5; cursor: default; }
	@media (hover: hover) {
		.status .small-btn:not(:disabled):hover { background: var(--primary); color: var(--paper); border-color: var(--primary); }
		.bubble.error .small-btn:not(:disabled):hover { background: var(--urgent); color: var(--paper); border-color: var(--urgent); }
	}

	/* Changes waiting for a yes: a bordered card with a real tick box per change */
	.plan {
		max-width: var(--measure); box-sizing: border-box;
		border: var(--bw) solid var(--primary); border-radius: var(--radius-lg);
		padding: var(--space-sm) var(--space-md) var(--space-md); background: var(--paper); transition: var(--swap);
	}
	.plan.settled { border-color: var(--primary-a25); padding-bottom: var(--space-sm); }
	.plan-title { margin: 0 0 var(--space-xs); font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--primary); }
	.actions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
	.action {
		display: flex; gap: var(--space-sm); align-items: baseline; font-size: var(--text-sm);
		line-height: var(--leading-snug); color: var(--ink); padding: 3px 0;
	}
	.action label { display: flex; gap: var(--space-sm); align-items: center; cursor: pointer; padding: 2px 0; }
	.action input {
		flex-shrink: 0; width: 22px; height: 22px; display: grid; place-items: center; padding: 0;
		border: var(--bw) solid var(--primary); border-radius: var(--radius-sm); background: var(--paper); cursor: pointer;
	}
	.action input:checked { background: var(--primary); }
	.action input:checked::before { content: '✓'; color: var(--paper); font-size: var(--text-sm); font-weight: var(--weight-bold); line-height: 1; }
	.action .mark { width: 1ch; flex-shrink: 0; font-weight: var(--weight-bold); color: var(--ok); }
	.action.failed .mark, .action .err, .err { color: var(--urgent); }
	.action.skipped, .action.skipped .mark { color: var(--primary); font-style: italic; }
	.actions > .action.done { color: var(--primary); }
	.plan-buttons { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); flex-wrap: wrap; }
	.plan-buttons .btn:disabled { border-color: var(--idle); background: var(--idle); color: var(--paper); cursor: default; }

	@media (prefers-reduced-motion: reduce) { .step.now .mark::before { animation: none; } }
</style>
