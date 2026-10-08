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
