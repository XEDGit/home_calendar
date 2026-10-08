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
