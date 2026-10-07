<script>
	// One automation as a window: its name is the title, the latest result is
	// the body, older runs fold away under History.
	import Collapsible from '$lib/containers/collapsible.svelte';
	import AutomationForm from './automationForm.svelte';
	import { linkify } from '$lib/helpers/linkify.js';
	import { updateAutomation, deleteAutomation, runAutomation } from '$lib/requests.js';

	export let automation;
	export let onChange = () => {};

	let editing = false;
	let busy = false;
	let actionError = '';

	$: latest = automation.results?.[0];
	$: older = automation.results?.slice(1) ?? [];
	$: status = automation.running ? 'running' : !automation.enabled ? 'paused' : automation.lastStatus || 'new';

	function ago(date) {
		if (!date) return 'never';
		const min = Math.round((Date.now() - new Date(date).getTime()) / 60000);
		if (min < 1) return 'just now';
		if (min < 60) return `${min} min ago`;
		if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
		return new Date(date).toLocaleString();
	}

	function fields(overrides = {}) {
		const s = automation.schedule;
		return { id: automation._id, name: automation.name, prompt: automation.prompt, every: s.every, unit: s.unit, at: s.at || '', enabled: automation.enabled, ...overrides };
	}

	async function act(fn) {
		busy = true;
		actionError = '';
		try {
			const res = await fn();
			if (res?.error) actionError = res.error;
		} finally { busy = false; }
		onChange();
	}

	const runNow = () => act(() => runAutomation(automation._id));
	const toggle = () => act(() => updateAutomation(fields({ enabled: !automation.enabled })));
	const remove = () => {
		if (confirm(`Delete automation "${automation.name}" and its results?`)) act(() => deleteAutomation(automation._id));
	};

	async function save(data) {
		const res = await updateAutomation({ id: automation._id, ...data });
		if (res?.error) return res.error;
		editing = false;
		onChange();
		return null;
	}
</script>

<style>
	.window {
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		background: var(--paper);
		color: var(--primary);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.titlebar {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		background: var(--primary);
		color: var(--paper);
	}

	.titlebar h3 {
		margin: 0;
		font-size: var(--text-base);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dot {
		width: 0.7em;
		height: 0.7em;
		border-radius: 50%;
		border: 2px solid var(--paper);
		flex: none;
	}

	.dot.ok { background: var(--paper); }
	.dot.error, .dot.interrupted { background: transparent; border-style: dashed; }
	.dot.running { animation: pulse 1s ease-in-out infinite alternate; background: var(--paper); }
	.dot.paused, .dot.new { background: transparent; }

	@keyframes pulse { to { opacity: 0.3; } }

	@media (prefers-reduced-motion: reduce) {
		.dot.running { animation: none; }
	}

	.tools {
		display: flex;
		gap: 4px;
	}

	.tools button {
		font: inherit;
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		cursor: pointer;
		background: var(--paper);
		color: var(--primary);
		border: none;
		border-radius: var(--radius-pill);
		padding: 2px 8px;
	}

	.tools button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.meta {
		font-size: var(--text-xs);
		padding: var(--space-xs) var(--space-sm) 0;
		opacity: 0.8;
	}

	.action-error {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		margin: 0;
		padding: var(--space-xs) var(--space-sm) 0;
	}

	.body {
		padding: var(--space-sm);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		line-height: 1.45;
	}

	.body a {
		color: inherit;
	}

	.failed {
		font-weight: var(--weight-bold);
	}

	.history {
		padding: 0 var(--space-sm) var(--space-sm);
	}

	.run {
		border-top: 1px solid var(--primary);
		padding: var(--space-xs) 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.run small {
		display: block;
		font-weight: var(--weight-bold);
	}
</style>

{#snippet resultText(r)}
	{#if r.ok}
		{#each linkify(r.text) as part}{#if part.url}<a href={part.url} target="_blank" rel="noopener noreferrer nofollow">{part.text}</a>{:else}{part.text}{/if}{/each}
	{:else}
		<span class="failed">Failed: {r.error}</span>
	{/if}
{/snippet}

<section class="window" aria-label={automation.name}>
	<header class="titlebar">
		<span class="dot {status}" title={status} aria-label="status {status}"></span>
		<h3>{automation.name}</h3>
		<div class="tools">
			<button on:click={runNow} disabled={busy || automation.running}>▶ Run</button>
			<button on:click={toggle} disabled={busy}>{automation.enabled ? 'Pause' : 'Resume'}</button>
			<button on:click={() => (editing = !editing)} disabled={busy}>Edit</button>
			<button on:click={remove} disabled={busy} aria-label="Delete {automation.name}">✕</button>
		</div>
	</header>
	<div class="meta">
		{automation.scheduleText}{automation.enabled ? '' : ' · paused'} · last run {ago(automation.lastRun)}{automation.running ? ' · running…' : ''}
	</div>
	{#if actionError}<p class="action-error" role="alert">{actionError}</p>{/if}
	<div class="body">
		{#if editing}
			<AutomationForm initial={automation} onSubmit={save} onCancel={() => (editing = false)} />
		{:else if latest}
			{@render resultText(latest)}
		{:else}
			<em>{automation.running ? 'First run in progress…' : 'No results yet. Press ▶ Run to try it now.'}</em>
		{/if}
	</div>
	{#if older.length && !editing}
		<div class="history">
			<Collapsible title="History ({older.length})">
				{#each older as r (r._id)}
					<div class="run">
						<small>{new Date(r.at).toLocaleString()}</small>
						{@render resultText(r)}
					</div>
				{/each}
			</Collapsible>
		</div>
	{/if}
</section>
