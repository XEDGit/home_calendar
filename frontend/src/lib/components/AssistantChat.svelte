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
