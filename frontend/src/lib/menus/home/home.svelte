<script>
	import { onMount } from 'svelte';
	import { getEvents, getChores, getUsers, getRooms, signChore, delChore, getTodos, getTags, updateTodo, getStats } from '$lib/requests';
	import Section from '$lib/header/Section.svelte';
	import ContentLayout from '$lib/containers/contentLayout.svelte';
	import Drag from '$lib/containers/drag.svelte';
	import GroupIcon from '$lib/icons/GroupIcon.svelte';
	import EventSheet from '$lib/sheet/EventSheet.svelte';
	import UpdateTask from '$lib/menus/chores/updateChore.svelte';
	import TodoSheet from '$lib/sheet/TodoSheet.svelte';
	import AssistantChat from '$lib/components/AssistantChat.svelte';
	import { reveal, vanish, expand, move, autoHeight, afterExit } from '$lib/motion';

	// ── Data ──────────────────────────────────────────────────────────────────
	let events = null;
	let chores = null;
	let users = null;
	let users_by_id = null;
	let rooms = null;
	let rooms_by_id = null;
	let todos = [];
	let tags = [];
	let activeTags = [];
	let stats = null;
	// Only the first load shows the loading line; refreshes update in place
	let loaded = false;

	// Kept alive in the background between visits: coming back to this tab
	// refreshes it in place
	// Called once the first data is in, so the page knows this tab can
	// slide in whole
	export let onReady = () => {};
	export let active = true;
	let wasActive = active;
	$: onActiveChange(active);
	function onActiveChange(isActive) {
		if (isActive && !wasActive && loaded) loadData();
		wasActive = isActive;
	}

	// ── Date ranges ───────────────────────────────────────────────────────────
	let eventsStartDate = new Date();
	let eventsEndDate = new Date();
	let eventsCustomRange = false;
	let eventsDateRangeText = 'Today';

	let choresStartDate = new Date();
	let choresEndDate = new Date();
	let choresCustomRange = false;
	let choresDateRangeText = 'Today';

	eventsStartDate.setHours(0, 0, 0, 0);
	eventsEndDate.setHours(23, 59, 59, 999);
	choresStartDate.setHours(0, 0, 0, 0);
	choresEndDate.setHours(23, 59, 59, 999);

	// ── UI state ──────────────────────────────────────────────────────────────
	let selectedEvent = null;
	let selectedChoreId = null;
	let selectedTodo = null;

	// ── Derived lists ─────────────────────────────────────────────────────────
	let todayEvents = [];
	let upcomingChores = [];
	let overdueChores = [];
	let userStats = [];

	$: maxStatCount = userStats.length ? Math.max(...userStats.map(s => s.count)) : 1;

	// ── Date range helpers ────────────────────────────────────────────────────
	function rangeLabel(days) {
		return days === 1 ? 'Today' : days === 2 ? 'Tomorrow' : days === 7 ? 'This Week' : days === 30 ? 'This Month' : `Next ${days} Days`;
	}

	function setEventsDateRange(days) {
		eventsCustomRange = false;
		eventsStartDate = new Date();
		eventsStartDate.setHours(0, 0, 0, 0);
		eventsEndDate = new Date();
		if (days === 2) eventsStartDate.setDate(eventsStartDate.getDate() + 1);
		if (days > 0) eventsEndDate.setDate(eventsEndDate.getDate() + days - 1);
		eventsEndDate.setHours(23, 59, 59, 999);
		eventsDateRangeText = rangeLabel(days);
		loadEventsWithDateRange();
	}

	function setChoresDateRange(days) {
		choresCustomRange = false;
		choresStartDate = new Date();
		if (days === 2) choresStartDate.setDate(choresStartDate.getDate() + 1);
		choresStartDate.setHours(0, 0, 0, 0);
		choresEndDate = new Date();
		if (days > 0) choresEndDate.setDate(choresEndDate.getDate() + days - 1);
		choresEndDate.setHours(23, 59, 59, 999);
		choresDateRangeText = rangeLabel(days);
		filterChores();
	}

	function setEventsCustomDateRange() { eventsCustomRange = true; eventsDateRangeText = 'Custom'; }
	function setChoresCustomDateRange() { choresCustomRange = true; choresDateRangeText = 'Custom'; filterChores(); }

	function updateEventsCustomDateRange() {
		if (typeof eventsStartDate === 'string') { eventsStartDate = new Date(eventsStartDate); eventsStartDate.setHours(0,0,0,0); }
		if (typeof eventsEndDate === 'string')   { eventsEndDate   = new Date(eventsEndDate);   eventsEndDate.setHours(23,59,59,999); }
		loadEventsWithDateRange();
	}

	function updateChoresCustomDateRange() {
		if (typeof choresStartDate === 'string') { choresStartDate = new Date(choresStartDate); choresStartDate.setHours(0,0,0,0); }
		if (typeof choresEndDate === 'string')   { choresEndDate   = new Date(choresEndDate);   choresEndDate.setHours(23,59,59,999); }
		filterChores();
	}

	// ── Filter helpers ────────────────────────────────────────────────────────
	function filterEvents() {
		if (events) todayEvents = [...events].sort((a, b) => new Date(a.when) - new Date(b.when));
	}

	function filterChores() {
		if (!chores) return;
		const upcoming = [];
		const overdue = [];
		const today = new Date();
		for (const day in chores) {
			const dayNum = parseInt(day);
			const dueDate = new Date(today);
			dueDate.setDate(today.getDate() + dayNum);
			dueDate.setHours(0, 0, 0, 0);
			if (dayNum < 0) {
				chores[day].forEach(c => overdue.push({ ...c, dueDate }));
			} else if (dueDate >= choresStartDate && dueDate <= choresEndDate) {
				chores[day].forEach(c => upcoming.push({ ...c, dueDate }));
			}
		}
		overdueChores = overdue.sort((a, b) => a.nextTime - b.nextTime);
		upcomingChores = upcoming.sort((a, b) => a.nextTime - b.nextTime);
	}

	function parseChores(res) {
		const perDay = res.reduce((acc, c) => {
			(acc[c.nextTime] = acc[c.nextTime] || []).push(c);
			return acc;
		}, {});
		const final = {};
		for (const day of Object.keys(perDay)) {
			const d = parseInt(day);
			if (d >= 7 && d < 14)    (final[7]  = final[7]  || []).push(...perDay[day]);
			else if (d > 14 && d <= 30) (final[14] = final[14] || []).push(...perDay[day]);
			else if (d < -7)            (final[-8] = final[-8] || []).push(...perDay[day]);
			else if (d > 42)            (final[43] = final[43] || []).push(...perDay[day]);
			else                        (final[day] = final[day] || []).push(...perDay[day]);
		}
		chores = final;
		filterChores();
	}

	async function loadEventsWithDateRange() {
		events = await getEvents(eventsStartDate.toISOString(), eventsEndDate.toISOString());
		filterEvents();
	}

	// ── Stats ─────────────────────────────────────────────────────────────────
	function computeStats() {
		if (!stats || !users) return;
		const weekAgo = new Date();
		weekAgo.setDate(weekAgo.getDate() - 7);
		const byUser = {};
		for (const s of stats) {
			if (new Date(s.date) >= weekAgo) {
				byUser[s.who] = (byUser[s.who] || 0) + (s.rooms?.length || 1);
			}
		}
		userStats = users
			.map(u => ({ name: u.name, color: u.color || 'var(--primary)', count: byUser[u._id] || 0 }))
			.sort((a, b) => b.count - a.count);
	}

	// ── Event handlers ────────────────────────────────────────────────────────
	function handleEventClick(evt) { selectedEvent = evt; }
	function handleEventClose() { selectedEvent = null; }
	// Saved from the sheet: reload, so repeats are worked out again by the server
	function handleEventUpdated() { loadData(); }
	function handleEventDeleted(id) { events = events.filter(e => e._id !== id); filterEvents(); }

	function handleChoreClick(id) { selectedChoreId = id; }
	function resetChoreSelection() { selectedChoreId = null; }
	// Each action folds the panel away first, then reshuffles the lists
	async function afterSignChore(data) {
		resetChoreSelection();
		await Promise.all([signChore(data), afterExit()]);
		await loadData();
	}
	async function afterDelChore(id) {
		resetChoreSelection();
		await Promise.all([delChore({ id }), afterExit()]);
		await loadData();
	}

	const handleTagClick = (idx) => { activeTags[idx] = !activeTags[idx]; activeTags = activeTags; };

	const filterTodos = (list) => {
		let top = list;
		for (let p = 3; p >= 0; p--) {
			top = list.filter(t => t.priority == p);
			if (top.length) break;
		}
		const anyActive = activeTags.some(Boolean);
		if (!anyActive) return top;
		const [personalActive, sharedActive] = activeTags;
		const activeRegular = tags.slice(2).filter((_, i) => activeTags[i + 2]);
		return top.filter(todo => {
			const matchTag = activeRegular.length ? activeRegular.includes(todo.tag) : true;
			if (!personalActive && !sharedActive) return matchTag;
			return matchTag && ((personalActive && !todo.shared) || (sharedActive && todo.shared));
		});
	};

	function handleTodoClick(todo) { selectedTodo = todo; }
	function resetTodoSelection() { selectedTodo = null; }

	// ── Format helpers ────────────────────────────────────────────────────────
	function fmtTime(d) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
	function fmtShortDate(d) { return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); }
	function fmtDeadline(d) {
		if (!d) return '';
		const dt = new Date(d);
		return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
	}
	function priorityColor(p) { return p === 3 ? 'var(--urgent)' : p === 2 ? 'var(--warn)' : p === 1 ? 'var(--ok)' : 'transparent'; }
	function urgencyColor(t) { return t < -2 ? 'var(--urgent)' : t <= -1 ? 'var(--warn)' : t === 0 ? 'var(--ok)' : 'var(--muted)'; }
	function dueLabel(t) {
		if (t <= -2) return `${Math.abs(t)}d late`;
		if (t === -1) return '1d late';
		if (t === 0) return 'today';
		if (t === 1) return 'tomorrow';
		if (t <= 7) return `${t}d`;
		if (t <= 14) return 'this week';
		return 'later';
	}
	function todayHeader() {
		return new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
	}

	// ── Load ──────────────────────────────────────────────────────────────────
	async function loadData() {
		const [ev, us, ro, td, tg, st, ch] = await Promise.all([
			getEvents(eventsStartDate.toISOString(), eventsEndDate.toISOString()),
			getUsers(),
			getRooms(),
			getTodos(),
			getTags(),
			getStats(),
			getChores(),
		]);
		// Assign everything in one synchronous pass: the page updates once,
		// fully formed, and the lists animate from old to new in one move
		events = ev;
		users = us;
		rooms = ro;
		todos = td;
		stats = st;
		tags = ['personal', 'shared', ...tg];
		users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
		rooms_by_id = Object.fromEntries(rooms.map(r => [r._id, r.name]));
		// Keep the household's tag filters across refreshes
		if (activeTags.length !== tags.length) activeTags = tags.map(() => false);
		parseChores(ch);
		filterEvents();
		computeStats();
		loaded = true;
		onReady();
	}

	onMount(loadData);
</script>

<style>
	/* ── Layout ────────────────────────────────────────────────────────────── */
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.section {
		margin-bottom: 8px;
	}

	/* ── Overview strip ────────────────────────────────────────────────────── */
	.overview-strip {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 8px;
		padding: 4px 0 16px;
		border-bottom: var(--bw-hair) solid var(--primary-a25);
		margin-bottom: 24px;
	}

	.overview-date {
		font-size: var(--text-md);
		font-weight: var(--weight-bold);
		color: var(--primary);
		text-wrap: balance;
	}

	.overview-counts {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		align-items: center;
	}

	.count-badge {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		color: var(--primary);
		background: var(--primary-a12);
		border-radius: var(--radius-pill);
		padding: 2px 10px;
		font-variant-numeric: tabular-nums;
	}

	.count-badge.overdue-badge {
		color: var(--urgent);
		background: var(--urgent-a12);
	}

	/* ── Date pills ────────────────────────────────────────────────────────── */
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: -12px;
		margin-bottom: 14px;
	}

	.pill {
		background: var(--paper);
		border: var(--bw) solid var(--primary);
		color: var(--primary);
		border-radius: var(--radius-pill);
		padding: var(--chip-pad-y) var(--chip-pad-x);
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		cursor: pointer;
		line-height: 1.4;
		transition: var(--swap);
	}

	.pill.active {
		background: var(--primary);
		color: var(--paper);
	}

	@media (hover: hover) {
		.pill:hover {
			background: var(--primary);
			color: var(--paper);
		}
	}

	/* ── Custom date inputs ────────────────────────────────────────────────── */
	.custom-dates {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 12px;
		font-size: var(--text-sm);
		color: var(--primary);
		align-items: center;
	}

	.custom-dates label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: var(--weight-bold);
	}

	.date-input {
		padding: 5px 8px;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		background: var(--paper);
		color: var(--primary);
	}

	/* ── Row list ──────────────────────────────────────────────────────────── */
	.row-list {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	/* ── Event rows ────────────────────────────────────────────────────────── */
	.event-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: var(--paper);
		border: var(--bw) solid var(--primary-a25);
		border-radius: var(--radius-md);
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.event-row:hover {
			border-color: var(--primary);
		}
	}

	.row-time {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		color: var(--primary);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		min-width: 3.2rem;
		white-space: nowrap;
	}

	.event-middle {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	/* The strike is always there, just transparent, so ticking a todo
	   draws the line in instead of snapping it on */
	.row-title {
		font-size: var(--text-base);
		font-weight: var(--weight-bold);
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-decoration-line: line-through;
		text-decoration-color: transparent;
		transition: text-decoration-color var(--dur-base) var(--ease-out);
	}

	.row-title.done {
		text-decoration-color: currentColor;
		font-weight: var(--weight-regular);
	}

	/* Second line under the title: the location, plus the date on phones */
	.row-sub {
		display: flex;
		gap: 6px;
		min-width: 0;
		font-size: var(--text-xs);
		color: var(--primary);
	}

	.row-sub:not(:has(.row-location)) {
		display: none;
	}

	.row-sub-date {
		display: none;
		flex-shrink: 0;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.row-location {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.row-date {
		font-size: var(--text-xs);
		color: var(--primary);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		white-space: nowrap;
	}

	/* ── Todo rows ─────────────────────────────────────────────────────────── */
	.todo-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 12px;
		background: var(--paper);
		border: var(--bw) solid var(--primary-a25);
		border-radius: var(--radius-md);
		transition: var(--swap);
	}

	@media (hover: hover) {
		.todo-row:hover {
			border-color: var(--primary);
		}
	}

	.todo-row input[type="checkbox"] {
		width: 24px;
		height: 24px;
		min-width: 24px;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-circle);
		background: var(--paper);
		cursor: pointer;
		margin-top: 2px;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	.todo-row input[type="checkbox"]:checked {
		background: var(--primary);
	}

	.todo-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: left;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		min-width: 0;
	}

	.todo-footer {
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
	}

	.tag-chip {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		color: var(--primary);
		background: var(--primary-a12);
		border-radius: var(--radius-pill);
		padding: 1px 8px;
		text-transform: lowercase;
	}

	.tag-chip::before {
		content: '# ';
	}

	.tag-pill {
		text-transform: lowercase;
	}

	.tag-pill::before {
		content: '# ';
	}

	.row-meta {
		font-size: var(--text-xs);
		color: var(--primary);
		font-variant-numeric: tabular-nums;
	}

	.shared-mark {
		display: inline-flex;
		color: var(--primary);
	}

	.priority-dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		flex-shrink: 0;
		align-self: center;
		margin-left: 2px;
	}

	/* ── Chore rows ────────────────────────────────────────────────────────── */
	/* Positioned so rows leaving the list stay anchored while the rest glide */
	.chore-groups {
		position: relative;
	}

	.chore-container {
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.chore-toggle {
		display: block;
		width: 100%;
		padding: 0;
		border: none;
		background: none;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.chore-left {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-left: 12px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.chore-right {
		display: flex;
		align-items: center;
		gap: 10px;
		padding-right: 14px;
		flex-shrink: 0;
	}

	.urgency-dot {
		width: 10px;
		height: 10px;
		min-width: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.chore-name-text {
		font-weight: var(--weight-bold);
		color: var(--paper);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: var(--text-base);
	}

	.chore-meta {
		font-size: var(--text-xs);
		color: var(--paper);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* ── Group labels ──────────────────────────────────────────────────────── */
	.group-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--primary);
		margin: 0 0 6px;
	}

	.group-label.overdue-label {
		color: var(--urgent);
	}

	.group-spacer {
		height: 10px;
	}

	/* ── Stats ─────────────────────────────────────────────────────────────── */
	.stats-bars {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.stat-row {
		display: grid;
		grid-template-columns: 5rem 1fr 2rem;
		align-items: center;
		gap: 10px;
	}

	.stat-label {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		color: var(--primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stat-bar-bg {
		height: 10px;
		background: var(--primary-a12);
		border-radius: var(--radius-pill);
		overflow: hidden;
	}

	/* Scale on the compositor instead of animating width */
	.stat-bar {
		height: 100%;
		width: 100%;
		border-radius: var(--radius-pill);
		transform-origin: left center;
		transition: transform var(--dur-slow) var(--ease-out);
	}

	.stat-count {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		color: var(--primary);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.stats-empty {
		font-size: var(--text-sm);
		color: var(--primary);
		font-style: italic;
	}

	/* ── Empty states ──────────────────────────────────────────────────────── */
	.empty-line {
		font-size: var(--text-sm);
		color: var(--primary);
		font-style: italic;
		margin: 4px 0 0;
	}

	/* ── Phones ────────────────────────────────────────────────────────────── */
	@media (max-width: 480px) {
		/* The date moves under the title, so the title keeps the width */
		.row-date {
			display: none;
		}

		.row-sub,
		.row-sub:not(:has(.row-location)) {
			display: flex;
		}

		.row-sub-date {
			display: inline;
		}

		.row-sub-date + .row-location::before {
			content: '· ';
		}

		/* Two lines of title instead of a few letters and an ellipsis */
		.row-title,
		.chore-name-text {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			white-space: normal;
			overflow-wrap: break-word;
			line-height: var(--leading-snug);
		}
	}
</style>

<ContentLayout loading={!loaded}>
	<div class="dashboard">

		<!-- Overview strip -->
		<div class="overview-strip">
			<span class="overview-date">{todayHeader()}</span>
			<div class="overview-counts">
				{#if overdueChores.length > 0}
					<span class="count-badge overdue-badge" in:reveal out:vanish>{overdueChores.length} overdue</span>
				{/if}
				<span class="count-badge">{todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''}</span>
				<span class="count-badge">{upcomingChores.length} chore{upcomingChores.length !== 1 ? 's' : ''} due</span>
			</div>
		</div>

		<!-- Assistant -->
		<div class="section">
			<Section title="Assistant" />
			<AssistantChat onChange={loadData} {active} />
		</div>

		<!-- Events -->
		<div class="section">
			<Section title="Events" subtitle={eventsDateRangeText} />
			<div class="pills">
				<button class="pill" class:active={eventsDateRangeText === 'Today'}      on:click={() => setEventsDateRange(1)}>Today</button>
				<button class="pill" class:active={eventsDateRangeText === 'Tomorrow'}   on:click={() => setEventsDateRange(2)}>Tomorrow</button>
				<button class="pill" class:active={eventsDateRangeText === 'This Week'}  on:click={() => setEventsDateRange(7)}>This Week</button>
				<button class="pill" class:active={eventsDateRangeText === 'This Month'} on:click={() => setEventsDateRange(30)}>This Month</button>
				<button class="pill" class:active={eventsCustomRange}                    on:click={setEventsCustomDateRange}>Custom</button>
			</div>
			{#if eventsCustomRange}
				<div class="custom-dates" transition:expand>
					<label>From <input class="date-input" type="date" bind:value={eventsStartDate} on:change={updateEventsCustomDateRange} /></label>
					<label>To   <input class="date-input" type="date" bind:value={eventsEndDate}   on:change={updateEventsCustomDateRange} /></label>
				</div>
			{/if}
			<div use:autoHeight><div>
			{#if todayEvents.length > 0}
				<div class="row-list">
					{#each todayEvents as event (event._id)}
						<button class="event-row" animate:move in:reveal out:vanish on:click={() => handleEventClick(event)}>
							<span class="row-time">{fmtTime(event.when)}</span>
							<span class="event-middle">
								<span class="row-title">{event.title}</span>
								<span class="row-sub">
									<span class="row-sub-date">{fmtShortDate(event.when)}</span>
									{#if event.location}
										<span class="row-location">{event.location}</span>
									{/if}
								</span>
							</span>
							<span class="row-date">{fmtShortDate(event.when)}</span>
						</button>
					{/each}
				</div>
			{:else}
				<p class="empty-line" in:reveal>No events for this period.</p>
			{/if}
			</div></div>
		</div>

		<!-- Todos -->
		<div class="section">
			<Section title="Important Todos" />
			{#if tags.length > 0}
				<div class="pills">
					{#each tags as tag, idx}
						<button class="pill tag-pill" class:active={activeTags[idx]} on:click={() => handleTagClick(idx)}>{tag}</button>
					{/each}
				</div>
			{/if}
			<div use:autoHeight><div>
			{#if filterTodos(todos).length > 0}
				<div class="row-list">
					{#each filterTodos(todos) as todo (todo._id)}
						<div class="todo-row" animate:move in:reveal out:vanish>
							<form on:submit|preventDefault>
								<input
									type="checkbox"
									aria-label="Mark {todo.title} done"
									bind:checked={todo.done}
									on:click|stopPropagation={async () => {
										const next = !todo.done;
										todo.done = next; todos = todos;
										try { await updateTodo({ _id: todo._id, done: next }); }
										catch { todo.done = !next; todos = todos; }
									}}
								/>
							</form>
							<button class="todo-body" on:click={() => handleTodoClick(todo)}>
								<span class="row-title" class:done={todo.done}>{todo.shortTitle || todo.title}</span>
								<span class="todo-footer">
									{#if todo.tag}<span class="tag-chip">{todo.tag}</span>{/if}
									{#if todo.deadline}<span class="row-meta">{fmtDeadline(todo.deadline)}</span>{/if}
									{#if todo.shared}<span class="shared-mark"><GroupIcon size={16} label="Shared" /></span>{/if}
								</span>
							</button>
							<span class="priority-dot" style="background:{priorityColor(todo.priority)}"></span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="empty-line" in:reveal>No todos match the selected filters.</p>
			{/if}
			</div></div>
		</div>

		<!-- Chores -->
		<div class="section">
			<Section title="Chores" subtitle={choresDateRangeText} />
			<div class="pills">
				<button class="pill" class:active={choresDateRangeText === 'Today'}      on:click={() => setChoresDateRange(1)}>Today</button>
				<button class="pill" class:active={choresDateRangeText === 'Tomorrow'}   on:click={() => setChoresDateRange(2)}>Tomorrow</button>
				<button class="pill" class:active={choresDateRangeText === 'This Week'}  on:click={() => setChoresDateRange(7)}>This Week</button>
				<button class="pill" class:active={choresDateRangeText === 'This Month'} on:click={() => setChoresDateRange(30)}>This Month</button>
				<button class="pill" class:active={choresCustomRange}                    on:click={setChoresCustomDateRange}>Custom</button>
			</div>
			{#if choresCustomRange}
				<div class="custom-dates" transition:expand>
					<label>From <input class="date-input" type="date" bind:value={choresStartDate} on:change={updateChoresCustomDateRange} /></label>
					<label>To   <input class="date-input" type="date" bind:value={choresEndDate}   on:change={updateChoresCustomDateRange} /></label>
				</div>
			{/if}

			<div use:autoHeight><div class="chore-groups">
			{#if overdueChores.length > 0}
				<p class="group-label overdue-label" transition:expand>Overdue</p>
				{#each overdueChores as chore (chore._id)}
					<div class="chore-container" animate:move in:reveal out:vanish>
						<button class="chore-toggle on-primary" aria-expanded={selectedChoreId === chore._id}
							on:click={() => selectedChoreId === chore._id ? resetChoreSelection() : handleChoreClick(chore._id)}>
						<Drag>
							<div class="chore-left">
								<span class="urgency-dot" style="background:{urgencyColor(chore.nextTime)}"></span>
								<span class="chore-name-text">{chore.name}</span>
							</div>
							<div class="chore-right">
								<span class="chore-meta">{chore.rooms.length}<span aria-hidden="true">r</span><span class="sr-only"> rooms</span></span>
								<span class="chore-meta">{dueLabel(chore.nextTime)}</span>
							</div>
						</Drag>
						</button>
						{#if selectedChoreId === chore._id}
							<div transition:expand>
								<UpdateTask
									chore={chore}
									users={users}
									onSubmit={(data) => { afterSignChore(data); resetChoreSelection(); }}
									reset={resetChoreSelection}
									delFunc={afterDelChore}
								/>
							</div>
						{/if}
					</div>
				{/each}
			{/if}

			{#if overdueChores.length > 0 && upcomingChores.length > 0}
				<div transition:expand>
					<div class="group-spacer"></div>
					<p class="group-label">Upcoming</p>
				</div>
			{/if}

			{#if upcomingChores.length > 0}
				{#each upcomingChores as chore (chore._id)}
					<div class="chore-container" animate:move in:reveal out:vanish>
						<button class="chore-toggle on-primary" aria-expanded={selectedChoreId === chore._id}
							on:click={() => selectedChoreId === chore._id ? resetChoreSelection() : handleChoreClick(chore._id)}>
						<Drag>
							<div class="chore-left">
								<span class="urgency-dot" style="background:{urgencyColor(chore.nextTime)}"></span>
								<span class="chore-name-text">{chore.name}</span>
							</div>
							<div class="chore-right">
								<span class="chore-meta">{chore.rooms.length}<span aria-hidden="true">r</span><span class="sr-only"> rooms</span></span>
								<span class="chore-meta">{dueLabel(chore.nextTime)}</span>
							</div>
						</Drag>
						</button>
						{#if selectedChoreId === chore._id}
							<div transition:expand>
								<UpdateTask
									chore={chore}
									users={users}
									onSubmit={(data) => { afterSignChore(data); resetChoreSelection(); }}
									reset={resetChoreSelection}
									delFunc={afterDelChore}
								/>
							</div>
						{/if}
					</div>
				{/each}
			{:else if overdueChores.length === 0}
				<p class="empty-line" in:reveal>No chores for this period.</p>
			{/if}
			</div></div>
		</div>

		<!-- Stats -->
		<div class="section">
			<Section title="This Week's Stats" />
			{#if userStats.some(s => s.count > 0)}
				<div class="stats-bars">
					{#each userStats as stat (stat.name)}
						<div class="stat-row" animate:move>
							<span class="stat-label">{stat.name}</span>
							<div class="stat-bar-bg">
								<div class="stat-bar" style="transform: scaleX({Math.max(0.03, stat.count / maxStatCount)}); background:{stat.color}"></div>
							</div>
							<span class="stat-count">{stat.count}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="stats-empty">No chore activity this week.</p>
			{/if}
		</div>

	</div>
</ContentLayout>

<!-- Event detail -->
{#if selectedEvent}
	<EventSheet event={selectedEvent} onClose={handleEventClose} onSaved={handleEventUpdated} onDeleted={handleEventDeleted} />
{/if}

<!-- Todo detail -->
{#if selectedTodo}
	<TodoSheet todo={selectedTodo} onClose={resetTodoSelection} onSaved={() => loadData()} onDeleted={() => loadData()} />
{/if}
