<script>
	import { getChores, getEvents, getUsers } from '$lib/requests';
	import { onMount, tick } from 'svelte';
	import EventSheet from '$lib/sheet/EventSheet.svelte';
	import { addStart } from '$lib/sheet/when.js';
	import { viewTransition, reveal } from '$lib/motion';

	// ── Constants ─────────────────────────────────────────────────────────────
	const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 07–22
	const DAY_SHORT  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const DAY_ABBR   = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
	const MONTH_NAMES = [
		'January','February','March','April','May','June',
		'July','August','September','October','November','December'
	];
	const MONTHS = MONTH_NAMES.map((name, value) => ({ value, name }));

	// ── State ─────────────────────────────────────────────────────────────────
	let events  = undefined;
	let chores  = undefined;
	let users   = undefined;
	// `loading` dims the body during a slow navigation; the first load never
	// dims. `ready` gates empty-state text until data has actually arrived.
	let loading = false;
	let ready   = false;
	let selectedEvent = null;
	let modalOpen     = false;
	// Known before the first render, so phones never flash the desktop grid
	let isMobileView  = typeof window !== 'undefined' && window.innerWidth < 768;
	let weekScrollEl;
	// Whether the hour grid has been scrolled to the current hour yet. It
	// can't while its tab is hidden in the background, so the tab does it
	// when it's first shown.
	let gridPlaced = false;

	// Kept alive in the background between visits: coming back to this tab
	// refreshes it in place
	// Called once the first data is in, so the page knows this tab can
	// slide in whole
	export let onReady = () => {};
	export let active = true;
	let wasActive = active;
	$: onActiveChange(active);
	async function onActiveChange(isActive) {
		const returning = isActive && !wasActive;
		wasActive = isActive;
		if (!returning) return;
		await tick();
		if (calView === 'week' && !gridPlaced) scrollToHour(Math.max(HOURS[0], today.getHours() - 1));
		if (ready) refreshPeriod();
	}

	let calView = 'week';  // 'month' | 'week'
	let filter  = 'both';  // 'events' | 'chores' | 'both'

	// Month state
	const today = new Date();
	let calendarDate = new Date();
	let monthDays    = [];
	$: years = Array.from({ length: 21 }, (_, i) => today.getFullYear() - 10 + i);

	// Week state
	let weekDate = new Date();
	$: weekDays   = getWeekDays(weekDate);
	$: showEvents = filter !== 'chores';
	$: showChores = filter !== 'events';

	// ── Helpers ───────────────────────────────────────────────────────────────
	function getMondayOfWeek(d) {
		const date = new Date(d);
		const day  = date.getDay();
		date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
		date.setHours(0, 0, 0, 0);
		return date;
	}

	function getWeekDays(d) {
		const mon = getMondayOfWeek(d);
		return Array.from({ length: 7 }, (_, i) => {
			const day = new Date(mon);
			day.setDate(day.getDate() + i);
			return day;
		});
	}

	function isToday(d) {
		return d.toDateString() === today.toDateString();
	}

	// Bucket events by day once per load instead of rescanning for every cell.
	$: eventsByDay = indexEventsByDay(events);

	function indexEventsByDay(list) {
		const map = new Map();
		for (const e of list ?? []) {
			const key = new Date(e.when).toDateString();
			if (!map.has(key)) map.set(key, []);
			map.get(key).push(e);
		}
		for (const day of map.values()) day.sort((a, b) => new Date(a.when) - new Date(b.when));
		return map;
	}

	function getEventsForDate(d) {
		return eventsByDay.get(d.toDateString()) ?? [];
	}

	function getEventsForDateHour(d, hour) {
		return getEventsForDate(d).filter(e => new Date(e.when).getHours() === hour);
	}

	function dayLabel(d) {
		return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
	}

	function getChoresForDate(d) {
		if (!chores) return [];
		const base   = new Date(today); base.setHours(0, 0, 0, 0);
		const target = new Date(d);    target.setHours(0, 0, 0, 0);
		return chores.filter(chore => {
			if (chore.nextTime <= 0) return target.getTime() === base.getTime();
			const due = new Date(base);
			due.setDate(due.getDate() + Math.round(chore.nextTime));
			return due.getTime() === target.getTime();
		});
	}

	function choreColor(nextTime) {
		if (nextTime < -2) return 'var(--urgent)';
		if (nextTime <= 0) return 'var(--warn)';
		if (nextTime <= 2) return 'var(--ok)';
		return 'var(--muted)';
	}

	function fmtTime(isoString) {
		const d = new Date(isoString);
		return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
	}

	$: headerLabel = (() => {
		if (calView === 'week' && weekDays?.length) {
			const first = weekDays[0], last = weekDays[6];
			if (first.getMonth() === last.getMonth())
				return MONTH_NAMES[first.getMonth()] + ' ' + first.getFullYear();
			return MONTH_NAMES[first.getMonth()].slice(0, 3) + '–' +
			       MONTH_NAMES[last.getMonth()].slice(0, 3) + ' ' + last.getFullYear();
		}
		return MONTH_NAMES[calendarDate.getMonth()] + ' ' + calendarDate.getFullYear();
	})();

	// ── Data ──────────────────────────────────────────────────────────────────
	// Navigation fetches first, then commits dates and events together, so the
	// grid never shows new dates with stale events. The newest request wins.
	let navToken = 0;

	async function fetchRange(start, end) {
		const [evData, chData, uData] = await Promise.all([
			getEvents(start.toISOString(), end.toISOString()),
			chores ?? getChores(),
			users ?? getUsers()
		]);
		return {
			events: Array.isArray(evData) ? evData : [],
			chores: Array.isArray(chData) ? chData : [],
			users: Array.isArray(uData) ? uData : []
		};
	}

	function weekRange(date) {
		const days  = getWeekDays(date);
		const start = new Date(days[0]); start.setHours(0, 0, 0, 0);
		const end   = new Date(days[6]); end.setHours(23, 59, 59, 999);
		return { start, end };
	}

	function monthLayout(date) {
		const year  = date.getFullYear(), month = date.getMonth();
		const firstDay    = new Date(year, month, 1);
		const lastDay     = new Date(year, month + 1, 0);
		const prevLastDay = new Date(year, month, 0);
		const start = new Date(year, month, 1 - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
		const end   = new Date(year, month + 1, 13 - lastDay.getDay());

		const days = [];
		for (let i = 1; i < firstDay.getDay(); i++) {
			days.push(new Date(year, month - 1, prevLastDay.getDate() - 5 + i));
		}
		for (let d = 1; d <= lastDay.getDate(); d++) {
			days.push(new Date(year, month, d));
		}
		for (let i = lastDay.getDay(); i < 14; i++) {
			days.push(new Date(year, month + 1, i - lastDay.getDay() + 1));
		}
		return { days, start, end };
	}

	/**
	 * Show a period. `dir` slides the calendar body the way time moved
	 * ('left' = earlier, 'right' = later, 'fade' = crossfade in place).
	 * `animate: false` commits in place (first load, refresh after an edit).
	 */
	async function showPeriod(view, date, { dir = 'none', animate = true } = {}) {
		const token = ++navToken;
		if (animate) loading = true;
		// Refreshes keep the user's place in the week grid
		const rescroll = animate || !ready;
		try {
			const month = view === 'month' ? monthLayout(date) : null;
			const { start, end } = month ?? weekRange(date);
			const data = await fetchRange(start, end);
			if (token !== navToken) return;

			const commit = async () => {
				events = data.events;
				chores = data.chores;
				users  = data.users;
				calView = view;
				if (month) {
					calendarDate = new Date(date);
					monthDays = month.days;
				} else {
					weekDate = new Date(date);
				}
				loading = false;
				ready = true;
				onReady();
				await tick();
				if (view === 'week' && rescroll) scrollToHour(Math.max(HOURS[0], today.getHours() - 1));
			};

			if (animate) await viewTransition(commit, { scope: 'calendar', dir });
			else await commit();
		} finally {
			if (token === navToken) loading = false;
		}
	}

	function scrollToHour(hour) {
		if (!weekScrollEl || !weekScrollEl.getClientRects().length) return;
		const target = weekScrollEl.querySelector(`[data-hour="${hour}"]`);
		if (!target) return;
		const containerTop = weekScrollEl.getBoundingClientRect().top;
		const targetTop    = target.getBoundingClientRect().top;
		weekScrollEl.scrollTop += targetTop - containerTop - 52;
		gridPlaced = true;
	}

	// ── Navigation ────────────────────────────────────────────────────────────
	function periodIndex(view, d) {
		return view === 'week'
			? Math.round(getMondayOfWeek(d).getTime() / (7 * 864e5))
			: d.getFullYear() * 12 + d.getMonth();
	}

	function directionTo(view, from, to) {
		const a = periodIndex(view, from), b = periodIndex(view, to);
		return b > a ? 'right' : b < a ? 'left' : 'fade';
	}

	function currentDate() {
		return calView === 'week' ? weekDate : calendarDate;
	}

	function navigateBy(step) {
		const d = new Date(currentDate());
		if (calView === 'week') d.setDate(d.getDate() + 7 * step);
		else d.setMonth(d.getMonth() + step);
		showPeriod(calView, d, { dir: step < 0 ? 'left' : 'right' });
	}

	function navigatePrev() { navigateBy(-1); }
	function navigateNext() { navigateBy(1); }

	function navigateToToday() {
		const now = new Date();
		showPeriod(calView, now, { dir: directionTo(calView, currentDate(), now) });
	}

	// The toggle reflects the choice at once; the body swaps when data is in
	let viewChoice = calView;

	function switchView(view) {
		if (view === viewChoice) return;
		viewChoice = view;
		showPeriod(view, view === 'month' ? weekDate : calendarDate, { dir: 'none' });
	}

	function setFilter(next) {
		if (next === filter) return;
		viewTransition(() => (filter = next), { scope: 'calendar', dir: 'fade' });
	}

	function refreshPeriod() {
		showPeriod(calView, currentDate(), { animate: false });
	}

	// ── Interactions ──────────────────────────────────────────────────────────
	function handleEventClick(event) { selectedEvent = event; modalOpen = true; }
	function handleEventClose()      { selectedEvent = null; addingAt = null; modalOpen = false; }

	// Saved from the sheet (an edit or a new event): reload the period, so
	// repeats are worked out again by the server
	function handleEventUpdated() {
		refreshPeriod();
	}

	function handleEventDeleted(id) {
		events = events.filter(e => e._id !== id);
		refreshPeriod();
	}

	// The add sheet: a day (and hour) clicked in the calendar, or the + button
	// (the day in view). Null while closed.
	let addingAt = null;
	export function openAdd(day = calendarDate, hour = null) {
		selectedEvent = null;
		addingAt = addStart(day, hour);
		modalOpen = true;
	}
	const goToAddEvent = (day, hour = null) => openAdd(day, hour);

	function handleMonthChange(e) {
		const d = new Date(calendarDate); d.setMonth(parseInt(e.target.value));
		showPeriod('month', d, { dir: directionTo('month', calendarDate, d) });
	}

	function handleYearChange(e) {
		const d = new Date(calendarDate); d.setFullYear(parseInt(e.target.value));
		showPeriod('month', d, { dir: directionTo('month', calendarDate, d) });
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────
	onMount(() => {
		isMobileView = window.innerWidth < 768;
		const onResize = () => { isMobileView = window.innerWidth < 768; };
		window.addEventListener('resize', onResize);
		// The hour grid exists before data does: scroll it now so nothing
		// jumps when events arrive
		scrollToHour(Math.max(HOURS[0], today.getHours() - 1));
		showPeriod('week', weekDate, { animate: false });
		return () => window.removeEventListener('resize', onResize);
	});
</script>

<style>
	/* ── Control bar ────────────────────────────────────────────────────────── */
	.control-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.toggle-group {
		display: flex;
		gap: 4px;
	}

	.toggle-btn {
		background-color: var(--paper);
		border-radius: var(--radius-md);
		color: var(--primary);
		border: var(--bw) solid var(--primary);
		padding: var(--chip-pad-y) var(--chip-pad-x);
		cursor: pointer;
		font-weight: var(--weight-bold);
		font-size: var(--text-sm);
		transition: var(--swap);
	}

	.toggle-btn.active {
		background-color: var(--primary);
		color: var(--paper);
	}

	@media (hover: hover) {
		.toggle-btn:hover {
			background-color: var(--primary);
			color: var(--paper);
		}
	}

	/* Mobile: replace button groups with selects */
	.control-bar-mobile {
		display: none;
	}

	.ctrl-select {
		flex: 1;
		padding: 6px 8px;
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		background-color: var(--paper);
		color: var(--primary);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}

	/* ── Calendar header ────────────────────────────────────────────────────── */
	.calendar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background-color: var(--primary);
		border-radius: var(--radius-lg);
		padding: 10px 15px;
		color: var(--paper);
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 0;
	}

	.date-display {
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
	}

	.nav-buttons {
		display: flex;
		gap: 8px;
	}

	.nav-button {
		background-color: var(--paper);
		color: var(--primary);
		border: none;
		padding: 6px 14px;
		min-height: var(--control-min-h);
		min-width: var(--control-min-h);
		border-radius: var(--radius-md);
		cursor: pointer;
		font-weight: var(--weight-bold);
		font-size: var(--text-sm);
		transition: var(--swap);
	}

	@media (hover: hover) { .nav-button:hover       { background-color: var(--paper-shade); } }
	.today-button           { border: var(--bw) solid var(--primary-deep); }
	@media (hover: hover) { .today-button:hover     { background-color: var(--paper-shade); } }

	.date-selectors {
		display: flex;
		gap: 8px;
	}

	select {
		padding: 5px 8px;
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary-deep);
		background-color: var(--paper);
		color: var(--primary);
		font-size: var(--text-sm);
	}

	/* ── Loading overlay ────────────────────────────────────────────────────── */
	.calendar-wrap {
		position: relative;
	}

	/* Dim only if a fetch is actually slow; quick ones never flicker */
	.calendar-wrap {
		transition: opacity var(--dur-fast) var(--ease-out);
	}

	.calendar-wrap.is-loading {
		opacity: 0.6;
		pointer-events: none;
		transition-delay: 150ms;
	}

	/* ── Shared pills ───────────────────────────────────────────────────────── */
	.event-pill {
		background-color: var(--primary);
		color: var(--paper);
		border-radius: var(--radius-sm);
		border: none;
		padding: 2px 5px;
		width: 100%;
		font: inherit;
		font-size: var(--text-xs);
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
		display: flex;
		gap: 4px;
		align-items: baseline;
		line-height: 1.5;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	@media (hover: hover) { .event-pill:hover { background-color: var(--primary-deep); } }

	.ep-time {
		font-weight: var(--weight-bold);
		flex-shrink: 0;
	}

	.ep-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chore-pill {
		background-color: var(--paper);
		color: var(--primary);
		border: var(--bw-hair) solid var(--primary);
		border-radius: var(--radius-sm);
		padding: 2px 5px;
		font-size: var(--text-xs);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: default;
		display: flex;
		align-items: center;
		gap: 4px;
		line-height: 1.5;
	}

	.chore-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	/* ── Overflow pill ──────────────────────────────────────────────────────── */
	.overflow-pill {
		font-size: var(--text-xs);
		color: var(--primary);
		font-weight: var(--weight-bold);
		padding: 1px 4px;
		white-space: nowrap;
	}

	/* ── Week view ──────────────────────────────────────────────────────────── */
	.week-scroll {
		overflow: auto;
		max-height: 66vh;
		border: var(--bw-hair) solid var(--primary-a25);
		border-radius: var(--radius-lg);
		margin-top: 10px;
		-webkit-overflow-scrolling: touch;
	}

	.week-grid {
		display: grid;
		grid-template-columns: 48px repeat(7, minmax(90px, 1fr));
		min-width: 680px;
	}

	/* Sticky corner */
	.corner-cell {
		position: sticky;
		top: 0;
		left: 0;
		z-index: 10;
		background-color: var(--primary);
		border-bottom: var(--bw-hair) solid var(--paper-a35);
	}

	/* Day headers — sticky top */
	.week-day-header {
		position: sticky;
		top: 0;
		z-index: 5;
		background-color: var(--primary);
		color: var(--paper);
		padding: 6px 4px;
		text-align: center;
		border-left: var(--bw-hair) solid var(--paper-a12);
		border-bottom: var(--bw-hair) solid var(--paper-a35);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		border-top: none;
		border-right: none;
		font: inherit;
		cursor: pointer;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.week-day-header:hover .wdh-num:not(.today-circle) {
			background-color: var(--paper-a12);
			border-radius: var(--radius-circle);
		}
	}

	.wdh-name {
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.wdh-num {
		font-size: var(--text-md);
		font-weight: var(--weight-bold);
		line-height: 1;
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.today-circle {
		background-color: var(--paper);
		color: var(--primary);
		border-radius: var(--radius-circle);
	}

	/* All-day row */
	.allday-label {
		position: sticky;
		left: 0;
		z-index: 3;
		background-color: var(--paper);
		color: var(--primary);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-align: right;
		padding: 4px 6px 4px 2px;
		border-bottom: var(--bw-hair) solid var(--primary-a25);
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
		padding-top: 5px;
	}

	.allday-cell {
		min-height: 28px;
		padding: 3px;
		border-left: var(--bw-hair) solid var(--primary-a12);
		border-bottom: var(--bw-hair) solid var(--primary-a25);
		background-color: var(--paper);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	/* Hour rows — time label sticky left */
	.hour-label {
		position: sticky;
		left: 0;
		z-index: 3;
		background-color: var(--paper);
		color: var(--primary);
		font-size: var(--text-xs);
		text-align: right;
		padding: 4px 6px 0 2px;
		border-right: var(--bw-hair) solid var(--primary-a25);
		line-height: 1;
		user-select: none;
	}

	.hour-cell {
		min-height: 48px;
		padding: 2px 3px;
		border-left: var(--bw-hair) solid var(--primary-a12);
		border-bottom: var(--bw-hair) solid var(--primary-a12);
		cursor: pointer;
		background-color: var(--paper);
		display: flex;
		flex-direction: column;
		gap: 2px;
		transition: background-color var(--dur-fast) var(--ease-out);
	}

	@media (hover: hover) { .hour-cell:hover             { background-color: var(--primary-a08); } }
	.hour-cell.today-col         { background-color: var(--primary-a08); }
	@media (hover: hover) { .hour-cell.today-col:hover   { background-color: var(--primary-a12); } }

	/* ── Month view ─────────────────────────────────────────────────────────── */
	.month-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px;
		margin-top: 10px;
	}

	.day-name-header {
		color: var(--primary);
		text-align: center;
		font-weight: var(--weight-bold);
		font-size: var(--text-xs);
		padding: 4px 0;
	}

	.month-day {
		border: var(--bw-hair) solid var(--primary);
		padding: 5px;
		min-height: 90px;
		color: var(--primary);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-ambient);
		overflow: hidden;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 2px;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.month-day:hover {
			background-color: var(--primary);
			color: var(--paper);
		}

		.month-day:hover .event-pill {
			background-color: var(--paper);
			color: var(--primary);
		}

		.month-day:hover .event-pill:hover {
			background-color: var(--paper-shade);
		}

		.month-day:hover .chore-pill {
			border-color: var(--paper);
		}
	}

	/* Adjacent-month days: dashed edge + regular-weight number, not faded text */
	.month-day.other-month  { border-style: dashed; box-shadow: none; }
	.month-day.other-month .day-num { font-weight: var(--weight-regular); }
	.month-day.today-day    { box-shadow: inset 0 0 0 2px var(--primary), var(--shadow-ambient); }

	.day-num {
		align-self: center;
		min-width: 28px;
		min-height: 28px;
		padding: 0 4px;
		border: none;
		border-radius: var(--radius-pill);
		background: none;
		color: inherit;
		font: inherit;
		font-weight: var(--weight-bold);
		font-size: var(--text-sm);
		margin-bottom: 1px;
		flex-shrink: 0;
		cursor: pointer;
	}

	/* ── Week agenda (phones) ──────────────────────────────────────────────── */
	.agenda {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.agenda-day {
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		padding: var(--space-sm);
		color: var(--primary);
	}

	.agenda-day.today-day {
		background-color: var(--primary-a08);
	}

	.agenda-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.agenda-date {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}

	.agenda-num {
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		line-height: 1;
	}

	.agenda-name {
		font-weight: var(--weight-bold);
		font-size: var(--text-sm);
	}

	.agenda-add {
		width: 44px;
		height: 44px;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-circle);
		background-color: var(--paper);
		color: var(--primary);
		font: inherit;
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		line-height: 1;
		cursor: pointer;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.agenda-add:hover {
			background-color: var(--primary);
			color: var(--paper);
		}
	}

	.agenda-items {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: var(--space-sm);
	}

	.agenda-items .event-pill,
	.agenda-items .chore-pill {
		font-size: var(--text-base);
		padding: 10px 12px;
		border-radius: var(--radius-md);
		min-height: 44px;
		align-items: center;
	}

	.agenda-empty {
		margin: 6px 0 0;
		font-size: var(--text-sm);
		font-style: italic;
	}

	/* ── Responsive ─────────────────────────────────────────────────────────── */
	@media (max-width: 767px) {
		/* Phone fields at 16px, or iOS zooms in when one is tapped */
		select { font-size: var(--text-base); }

		/* Swap control bar: hide buttons, show selects */
		.control-bar        { display: none; }
		.control-bar-mobile {
			display: flex;
			gap: 8px;
			margin-bottom: 8px;
		}

		/* Compact calendar header into one row */
		.calendar-header {
			flex-direction: row;
			flex-wrap: nowrap;
			justify-content: space-between;
			padding: 6px 10px;
			gap: 4px;
		}

		.date-display   { font-size: var(--text-sm); font-weight: var(--weight-bold); }
		.nav-button     { padding: 4px 9px; font-size: var(--text-sm); }
		.nav-buttons    { gap: 4px; }
		.date-selectors { display: none; } /* hidden on week; month shows dropdowns */

		/* Week scroll fills remaining viewport after all bars above */
		.week-scroll {
			max-height: calc(100vh - 230px); /* fallback */
			max-height: calc(100dvh - 230px);
		}

		.month-day {
			min-height: 60px;
			padding: 3px;
			gap: 1px;
		}

		.day-num { font-size: var(--text-xs); }

		.month-grid .event-pill, .month-grid .chore-pill {
			font-size: var(--text-xs);
			padding: 1px 3px;
		}

		/* Month cells are too narrow for times; the agenda keeps them */
		.month-grid .ep-time { display: none; }

		/* Event pills stay finger-sized (24px) in touch-sized month cells */
		.month-grid .event-pill {
			min-height: 24px;
			align-items: center;
		}
	}

	@media (max-width: 480px) {
		.month-day { min-height: 46px; }

		/* "+2 more" can't fit a phone's month cell: show "+2", still read in full */
		.month-grid .more-word {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}

		.chore-pill, .event-pill {
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>

<!-- Control bar: button groups (desktop) -->
<div class="control-bar">
	<div class="toggle-group">
		<button class="toggle-btn" class:active={viewChoice === 'month'} aria-pressed={viewChoice === 'month'} on:click={() => switchView('month')}>Month</button>
		<button class="toggle-btn" class:active={viewChoice === 'week'}  aria-pressed={viewChoice === 'week'}  on:click={() => switchView('week')}>Week</button>
	</div>
	<div class="toggle-group">
		<button class="toggle-btn" class:active={filter === 'events'} aria-pressed={filter === 'events'} on:click={() => setFilter('events')}>Events</button>
		<button class="toggle-btn" class:active={filter === 'chores'} aria-pressed={filter === 'chores'} on:click={() => setFilter('chores')}>Chores</button>
		<button class="toggle-btn" class:active={filter === 'both'}   aria-pressed={filter === 'both'}   on:click={() => setFilter('both')}>Both</button>
	</div>
</div>

<!-- Control bar: selects (mobile) -->
<div class="control-bar-mobile">
	<select class="ctrl-select" aria-label="Calendar view" value={viewChoice} on:change={e => switchView(e.target.value)}>
		<option value="month">Month</option>
		<option value="week">Week</option>
	</select>
	<select class="ctrl-select" aria-label="Show" value={filter} on:change={e => setFilter(e.target.value)}>
		<option value="events">Events</option>
		<option value="chores">Chores</option>
		<option value="both">Both</option>
	</select>
</div>

<!-- Calendar header -->
<div class="calendar-header on-primary">
	<div class="nav-buttons">
		<button class="nav-button" on:click={navigatePrev} aria-label={calView === 'week' ? 'Previous week' : 'Previous month'}>&#8592;</button>
		<button class="nav-button today-button" on:click={navigateToToday}>Today</button>
		<button class="nav-button" on:click={navigateNext} aria-label={calView === 'week' ? 'Next week' : 'Next month'}>&#8594;</button>
	</div>

	<div class="date-display">{headerLabel}</div>

	{#if calView === 'month'}
		<div class="date-selectors">
			<select aria-label="Month" value={calendarDate.getMonth()} on:change={handleMonthChange}>
				{#each MONTHS as m}
					<option value={m.value}>{m.name}</option>
				{/each}
			</select>
			<select aria-label="Year" value={calendarDate.getFullYear()} on:change={handleYearChange}>
				{#each years as y}
					<option value={y}>{y}</option>
				{/each}
			</select>
		</div>
	{/if}
</div>

<!-- Calendar body -->
<div class="calendar-wrap calendar-body" class:is-loading={loading} aria-busy={loading}>

	{#if calView === 'week' && isMobileView}
		<!-- ── Week agenda (phones): one day per row, no sideways scroll ───── -->
		<ol class="agenda">
			{#each weekDays as day, i}
				{@const dEvents = showEvents ? getEventsForDate(day) : []}
				{@const dChores = showChores ? getChoresForDate(day) : []}
				<li class="agenda-day" class:today-day={isToday(day)}>
					<div class="agenda-head">
						<span class="agenda-date">
							<span class="agenda-num">{day.getDate()}</span>
							<span class="agenda-name">{DAY_SHORT[i]}{isToday(day) ? ' · Today' : ''}</span>
						</span>
						<button class="agenda-add" on:click={() => goToAddEvent(day)} aria-label="Add event on {dayLabel(day)}">+</button>
					</div>
					{#if dEvents.length || dChores.length}
						<div class="agenda-items" in:reveal>
							{#each dEvents as event}
								<button class="event-pill agenda-event" on:click={() => handleEventClick(event)}>
									<span class="ep-time">{fmtTime(event.when)}</span>
									<span class="ep-title">{event.title}</span>
								</button>
							{/each}
							{#each dChores as chore}
								<div class="chore-pill">
									<span class="chore-dot" style="background-color: {choreColor(chore.nextTime)}"></span>
									<span class="ep-title">{chore.name}</span>
								</div>
							{/each}
						</div>
					{:else if ready}
						<p class="agenda-empty" in:reveal>Nothing planned</p>
					{/if}
				</li>
			{/each}
		</ol>

	{:else if calView === 'week'}
		<!-- ── Week view ─────────────────────────────────────────────────────── -->
		<div class="week-scroll" bind:this={weekScrollEl}>
			<div class="week-grid">

				<!-- Header row: each day header is the keyboard path to "add event" -->
				<div class="corner-cell"></div>
				{#each weekDays as day, i}
					<button class="week-day-header on-primary" on:click={() => goToAddEvent(day)} aria-label="Add event on {dayLabel(day)}">
						<span class="wdh-name">{DAY_SHORT[i]}</span>
						<span class="wdh-num" class:today-circle={isToday(day)}>{day.getDate()}</span>
					</button>
				{/each}

				<!-- All-day row (chores). Cells are a mouse shortcut; keyboard uses the day header. -->
				{#if showChores}
					<div class="allday-label">all-day</div>
					{#each weekDays as day}
						{@const dayChores = getChoresForDate(day)}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<div class="allday-cell" on:click={e => { if (!e.target.closest('.chore-pill')) goToAddEvent(day); }}>
							{#each dayChores.slice(0, 3) as chore}
								<div class="chore-pill" in:reveal>
									<span class="chore-dot" style="background-color: {choreColor(chore.nextTime)}"></span>
									<span class="ep-title">{chore.name}</span>
								</div>
							{/each}
							{#if dayChores.length > 3}
								<div class="overflow-pill">+{dayChores.length - 3} more</div>
							{/if}
						</div>
					{/each}
				{/if}

				<!-- Hour rows -->
				{#each HOURS as hour}
					<div class="hour-label" data-hour={hour}>
						{String(hour).padStart(2, '0')}:00
					</div>
					{#each weekDays as day}
						<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
						<div
							class="hour-cell"
							class:today-col={isToday(day)}
							on:click={e => { if (!e.target.closest('.event-pill')) goToAddEvent(day, hour); }}
						>
							{#if showEvents}
								{#each getEventsForDateHour(day, hour) as event}
									<button class="event-pill" in:reveal on:click={() => handleEventClick(event)}>
										<span class="ep-time">{fmtTime(event.when)}</span>
										<span class="ep-title">{event.title}</span>
									</button>
								{/each}
							{/if}
						</div>
					{/each}
				{/each}

			</div>
		</div>

	{:else}
		<!-- ── Month view ────────────────────────────────────────────────────── -->
		<div class="month-grid">
			{#each DAY_ABBR as dn}
				<div class="day-name-header" aria-hidden="true">{dn}</div>
			{/each}

			{#each monthDays as day}
				{@const mEvents = showEvents ? getEventsForDate(day) : []}
				{@const mChores = showChores ? getChoresForDate(day) : []}
				{@const mOverflow = Math.max(0, mEvents.length - 3) + Math.max(0, mChores.length - 2)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div
					class="month-day"
					class:other-month={day.getMonth() !== calendarDate.getMonth()}
					class:today-day={day.toDateString() === today.toDateString()}
					on:click={e => { if (!e.target.closest('.event-pill') && !e.target.closest('.chore-pill') && !e.target.closest('.day-num')) goToAddEvent(day); }}
				>
					<button class="day-num" on:click={() => goToAddEvent(day)} aria-label="Add event on {dayLabel(day)}">{day.getDate()}</button>

					{#each mEvents.slice(0, 3) as event}
						<button class="event-pill" in:reveal on:click={() => handleEventClick(event)}>
							{#if !isMobileView}
								<span class="ep-time">{fmtTime(event.when)}</span>
							{/if}
							<span class="ep-title">{event.title}</span>
						</button>
					{/each}

					{#each mChores.slice(0, 2) as chore}
						<div class="chore-pill" in:reveal>
							<span class="chore-dot" style="background-color: {choreColor(chore.nextTime)}"></span>
							<span class="ep-title">{chore.name}</span>
						</div>
					{/each}

					{#if mOverflow > 0}
						<div class="overflow-pill">+{mOverflow}<span class="more-word"> more</span></div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

</div>

{#if selectedEvent}
	<EventSheet
		event={selectedEvent}
		onClose={handleEventClose}
		onSaved={handleEventUpdated}
		onDeleted={handleEventDeleted}
	/>
{:else if addingAt}
	<EventSheet
		start={addingAt}
		onClose={handleEventClose}
		onSaved={handleEventUpdated}
	/>
{/if}
