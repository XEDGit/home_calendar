<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import AssistantThread from '$lib/assistant/AssistantThread.svelte';
	import AssistantInput from '$lib/assistant/AssistantInput.svelte';
	import { conversations, threads, listLoaded, open, send, remove, setVisible, selected } from '$lib/assistant/store.js';

	export let active = true;
	export let onReady = () => {};

	let current = null;      // open conversation, null = new chat
	let showList = true;     // phones: list or conversation
	let error = null;
	let reported = false;
	let isPhone = false;     // same breakpoint as the CSS below
	let root;
	let top = 0;             // px from the page top to this tab, so it can fill the rest of the screen
	let starting = false;    // a suggestion was tapped and is being sent

	// Questions that work in every household; tapping one asks it
	const suggestions = [
		"What's due today?",
		'Which chores are overdue?',
		"What's on the calendar this week?",
	];

	$: if ($listLoaded && !reported) { reported = true; onReady(); }
	$: if (active && $selected !== undefined) { pick($selected); selected.set(undefined); }
	// On a phone the list pane hides the conversation, so it is not being looked at
	$: setVisible('tab', active && !(isPhone && showList) ? current : null);
	$: messages = (current && $threads[current]) || [];
	$: title = current ? ($conversations.find(c => c._id === current)?.title ?? '') : 'New chat';

	// The tab is as tall as the screen below the header and nav: messages scroll
	// inside it and the page itself never grows, so the nav stays in sight.
	async function measure() {
		if (!root || !active) return;
		await tick();
		const t = root.getBoundingClientRect().top + window.scrollY;
		if (t > 0) top = Math.round(t);
	}
	$: if (active) measure();

	onMount(() => {
		const mq = window.matchMedia('(max-width: 720px)');
		const update = () => { isPhone = mq.matches; measure(); };
		update();
		mq.addEventListener('change', update);
		window.addEventListener('resize', measure);
		return () => {
			mq.removeEventListener('change', update);
			window.removeEventListener('resize', measure);
		};
	});

	onDestroy(() => setVisible('tab', null));

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

	async function suggest(text) {
		if (starting) return;
		starting = true;
		const r = await onSend(text);
		starting = false;
		if (r.error) error = r.error;
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

<div class="assistant-tab" class:show-list={showList} bind:this={root} style:--tab-top="{top}px">
	<aside class="panel list" aria-labelledby="chats-heading">
		<div class="band on-primary">
			<h2 id="chats-heading">Chats</h2>
			<button class="band-btn" on:click={newChat}>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" />
				</svg>
				New chat
			</button>
		</div>
		{#if error}<p class="err" role="alert">{error}</p>{/if}
		<ul>
			{#each $conversations as c (c._id)}
				<li class:current={c._id === current} class:on-primary={c._id === current}>
					<button class="row" on:click={() => pick(c._id)} aria-current={c._id === current ? 'true' : undefined}>
						<span class="name">{c.title}</span>
						<span class="meta">
							{#if c.unread}<span class="dot" aria-hidden="true"></span><span class="sr-only">Unread,</span>{/if}
							{#if c.busy}<span class="busy">Answering…</span>{/if}
							<time datetime={c.updatedAt}>{ago(c.updatedAt)}</time>
						</span>
					</button>
					<button class="del" on:click={() => del(c._id)} aria-label={`Delete ${c.title}`} title="Delete">
						<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
							<path d="M4 7h16M10 3h4M6 7l1 13h10l1-13M10 11v5M14 11v5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</li>
			{:else}
				{#if $listLoaded}<li class="empty">No chats yet. Ask something and it shows up here.</li>{/if}
			{/each}
		</ul>
	</aside>

	<section class="panel conversation" aria-labelledby="conversation-heading">
		<div class="band on-primary">
			<button class="band-btn back" on:click={() => (showList = true)}>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
					<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				Chats
			</button>
			<h2 id="conversation-heading">{title}</h2>
			{#if current}
				<button class="band-icon" on:click={() => del(current)} aria-label="Delete this chat" title="Delete this chat">
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
						<path d="M4 7h16M10 3h4M6 7l1 13h10l1-13M10 11v5M14 11v5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</button>
			{/if}
		</div>
		<div class="thread">
			{#if messages.length}
				<AssistantThread conversationId={current} {messages} onAskAgain={onSend} maxHeight="none" />
			{:else if !current}
				<div class="start">
					<p class="hint">Ask about the calendar, chores and todos, or tell me what you did and I'll update them.</p>
					<div class="suggestions">
						{#each suggestions as s}
							<button class="chip" disabled={starting} on:click={() => suggest(s)}>{s}</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
		<div class="composer">
			<AssistantInput {onSend} />
		</div>
	</section>
</div>

<style>
	/* Exactly the screen below the header and nav (see measure()); never taller */
	.assistant-tab {
		--column: 46rem;  /* reading column for messages and the input */
		height: max(20rem, calc(100vh - var(--tab-top, 0px) - var(--space-md)));
		height: max(20rem, calc(100dvh - var(--tab-top, 0px) - var(--space-md)));
		display: grid;
		/* minmax(0, …): a plain 1fr can't shrink below its longest title */
		grid-template-columns: minmax(15rem, 20rem) minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		gap: var(--space-md);
	}

	/* Two panels, built like the kanban columns: a 2px rose border and a
	 * rose header band that carries the panel's name and its actions */
	.panel {
		display: flex; flex-direction: column; min-width: 0; min-height: 0;
		border: var(--bw) solid var(--primary); border-radius: var(--radius-lg);
		background: var(--paper); overflow: hidden;
	}
	.band {
		display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0;
		min-height: 3rem; box-sizing: border-box; padding: var(--space-xs) var(--space-xs) var(--space-xs) var(--space-md);
		background: var(--primary); color: var(--paper);
	}
	.band h2 {
		flex: 1; min-width: 0; margin: 0; font-size: var(--text-md); line-height: var(--leading-tight);
		display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
		overflow-wrap: break-word;
	}
	/* On rose the inversion runs the other way: paper at rest, rose on hover */
	.band-btn {
		display: inline-flex; align-items: center; gap: var(--space-xs); flex-shrink: 0;
		min-height: var(--control-min-h); padding: 0 var(--space-sm); white-space: nowrap;
		border: var(--bw) solid var(--paper); border-radius: var(--radius-md);
		background: var(--paper); color: var(--primary);
		font: inherit; font-weight: var(--weight-bold); cursor: pointer; transition: var(--swap);
	}
	.band-icon {
		flex-shrink: 0; display: grid; place-items: center; padding: 0;
		width: var(--control-min-h); height: var(--control-min-h);
		border: var(--bw) solid transparent; border-radius: var(--radius-md);
		background: none; color: var(--paper); cursor: pointer; transition: var(--swap);
	}
	@media (hover: hover) {
		.band-btn:hover { background: var(--primary); color: var(--paper); }
		.band-icon:hover { border-color: var(--paper); }
	}
	.back { display: none; padding-left: var(--space-xs); }

	/* ── Chat list ── */
	.list ul {
		list-style: none; margin: 0; padding: var(--space-xs); display: flex; flex-direction: column; gap: 2px;
		flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
		scrollbar-width: thin; scrollbar-color: var(--primary-a45) transparent;
	}
	/* Rows: rose ink on cream; the open chat wears rose (inverted) */
	.list li {
		display: flex; align-items: center; border-radius: var(--radius-md);
		color: var(--primary); transition: var(--swap);
	}
	.list li.current { background: var(--primary); color: var(--paper); }
	.row {
		flex: 1; min-width: 0; text-align: left; background: none; border: none; cursor: pointer;
		padding: var(--space-sm); font: inherit; color: inherit; border-radius: inherit;
		display: flex; flex-direction: column; gap: 3px;
	}
	/* Two lines of title instead of a few letters and an ellipsis */
	.name {
		display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden;
		overflow-wrap: break-word; font-weight: var(--weight-bold); line-height: var(--leading-snug);
	}
	.meta {
		display: flex; flex-wrap: wrap; align-items: center; gap: 0 var(--space-xs);
		font-size: var(--text-xs); line-height: var(--leading-snug); white-space: nowrap;
	}
	.busy { font-style: italic; }
	.dot { width: 8px; height: 8px; flex-shrink: 0; border-radius: var(--radius-circle); background: currentColor; }
	.del {
		flex-shrink: 0; width: var(--control-min-h); height: var(--control-min-h); margin-right: var(--space-xs);
		display: grid; place-items: center; padding: 0; border: none; border-radius: var(--radius-sm);
		background: none; color: inherit; cursor: pointer;
		transition: var(--swap), opacity var(--dur-fast) var(--ease-out);
	}
	/* The list scrolls, so focus rings sit inside the row rather than being clipped */
	.row:focus-visible, .del:focus-visible { outline-offset: -2px; }
	@media (hover: hover) {
		.list li:not(.current):hover { background: var(--paper-shade); }
		.del:hover { background: var(--paper); color: var(--danger); }
		/* With a pointer, a row's delete shows on hover or focus; touch always sees it */
		.list li:not(.current):not(:hover):not(:focus-within) .del { opacity: 0; }
	}
	.empty { padding: var(--space-sm); color: var(--primary); font-style: italic; font-size: var(--text-sm); }
	.err { margin: var(--space-sm) var(--space-md) 0; color: var(--urgent); font-size: var(--text-sm); }

	/* ── Conversation ── */
	/* Only the messages scroll; the band and the input stay put. Messages
	 * and input share one centred reading column; the scrollbar stays at
	 * the panel's edge. */
	.thread { flex: 1; min-height: 0; display: flex; flex-direction: column; }
	.thread :global(.log) {
		flex: 1; min-height: 0; gap: var(--space-md);
		padding: var(--space-md) max(var(--space-md), calc((100% - var(--column)) / 2));
		scrollbar-width: thin; scrollbar-color: var(--primary-a45) transparent;
	}
	.composer {
		flex-shrink: 0; padding: var(--space-sm) max(var(--space-md), calc((100% - var(--column)) / 2)) var(--space-md);
		border-top: var(--bw-hair) solid var(--primary-a25);
	}

	/* A new chat says what the assistant can do and offers a first question */
	.start {
		margin: auto; padding: var(--space-lg) var(--space-md); box-sizing: border-box;
		width: min(100%, var(--column)); display: flex; flex-direction: column; gap: var(--space-md);
	}
	.hint { margin: 0; color: var(--primary); font-size: var(--text-md); text-wrap: pretty; }
	.suggestions { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
	.suggestions .chip { white-space: nowrap; font-size: var(--text-sm); }
	.suggestions .chip:disabled { border-color: var(--idle); color: var(--idle); background: var(--paper); cursor: default; }

	/* Phones: one pane at a time */
	@media (max-width: 720px) {
		.assistant-tab { grid-template-columns: minmax(0, 1fr); }
		.assistant-tab.show-list .conversation { display: none; }
		.assistant-tab:not(.show-list) .list { display: none; }
		.back { display: inline-flex; }
		.band:has(.back) { padding-left: var(--space-xs); }
		.band h2 { font-size: var(--text-base); }
		.start { margin: auto 0 0; }
	}
</style>
