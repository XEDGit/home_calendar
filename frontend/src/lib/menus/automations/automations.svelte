<script>
	import { onMount, onDestroy } from 'svelte';
	import { getAutomations } from '#lib/requests.js';
	import { reveal, vanish, move } from '#lib/motion.js';
	import AutomationWindow from './automationWindow.svelte';

	// Kept alive in the background between visits (see routes/+page.svelte):
	// refreshes when it becomes active again, and polls while a run is going
	export let onReady = () => {};
	export let active = true;

	let list = [];
	let loaded = false;
	let loadError = '';
	let wasActive = active;
	let poll;

	$: onActiveChange(active);
	function onActiveChange(isActive) {
		if (isActive && !wasActive) load();
		wasActive = isActive;
	}

	$: running = list.some((a) => a.running);
	$: setPolling(running && active);
	function setPolling(on) {
		if (on && !poll) poll = setInterval(load, 5000);
		if (!on && poll) { clearInterval(poll); poll = null; }
	}

	async function load() {
		const res = await getAutomations();
		// A transient error (backend hiccup, network blip) must not blank out an
		// already-loaded list: keep showing it and report the error instead, so
		// the empty state (which invites adding a duplicate) only ever appears
		// for a real, successful `[]`.
		if (Array.isArray(res)) { list = res; loadError = ''; }
		else loadError = res?.error || 'Could not load automations';
		if (!loaded) { loaded = true; onReady(); }
	}

	onMount(load);
	onDestroy(() => setPolling(false));
</script>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
		gap: var(--space-md);
		align-items: start;
		width: 100%;
	}

	.empty {
		color: var(--primary);
		max-width: 44ch;
		line-height: 1.5;
	}

	.error {
		color: var(--primary);
		font-weight: var(--weight-bold);
		font-size: var(--text-xs);
		margin: 0 0 var(--space-sm);
	}
</style>

{#if loadError}<p class="error" role="alert">{loadError}</p>{/if}
{#if loaded && !list.length && !loadError}
	<p class="empty">
		No automations yet. An automation is a task the assistant runs on its own on a schedule,
		like "every morning at 8, sum up today's weather and the news about our town".
		It can read your household data and search the web, but never changes anything.
		Tap + to add one, or ask the assistant on the home page.
	</p>
{:else}
	<div class="grid">
		{#each list as automation (automation._id)}
			<div animate:move in:reveal out:vanish>
				<AutomationWindow {automation} onChange={load} />
			</div>
		{/each}
	</div>
{/if}
