<script>
	import Section from "#lib/header/Section.svelte";
	import UpdateTask from "./updateChore.svelte";
	import { onMount } from "svelte";
	import { getStats, getUsers, getChores, signChore, skipChore, delChore, getRooms } from '#lib/requests.js';
	import RoomFilter from "#lib/filters/roomFilter.svelte";
	import { reveal, vanish, expand, move, afterExit } from "#lib/motion.js";

	let chores = undefined;
	let sortedDays = [];
	let stats = null;
	let users = null;
	let users_by_id = null;
	let rooms = null;

	let chores_filter = [];
	let search = '';
	let activeChore = null;

	// Kept alive in the background between visits: coming back to this tab
	// refreshes it in place
	// Called once the first data is in, so the page knows this tab can
	// slide in whole
	export let onReady = () => {};
	export let active = true;
	let wasActive = active;
	$: onActiveChange(active);
	function onActiveChange(isActive) {
		if (isActive && !wasActive && chores !== undefined) load();
		wasActive = isActive;
	}

	function filterChores(chores_list) {
		let result = chores_list;
		if (search.trim()) {
			result = result.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
		}
		if (chores_filter.length) {
			result = result.filter(c => c.rooms.some(r => chores_filter.includes(r.name)));
		}
		return result;
	}

	async function sortChores() {
		const sorted_stats = stats.sort((a, b) => a.date < b.date ? 1 : -1);
		let res = await getChores();
		let perDay = res.reduce((acc, chore) => {
			chore.last_sign = users_by_id[sorted_stats.find(s => s.chore_ref == chore._id)?.who]?.name || 'Nobody';
			const key = chore.nextTime;
			if (!acc[key]) acc[key] = [];
			acc[key].push(chore);
			return acc;
		}, {});

		let final = {};
		for (let day of Object.keys(perDay)) {
			const d = Number(day);
			let bucket;
			if (d < -7) bucket = -8;
			else if (d < 0) bucket = d;
			else if (d === 0) bucket = 0;
			else if (d === 1) bucket = 1;
			else if (d < 7) bucket = d;
			else if (d < 14) bucket = 7;
			else if (d <= 30) bucket = 14;
			else if (d > 42) bucket = 43;
			else bucket = d;

			if (!final[bucket]) final[bucket] = [];
			final[bucket].push(...perDay[day]);
		}

		chores = final;
		sortedDays = Object.keys(chores).sort((a, b) => Number(a) - Number(b));
	}

	async function load() {
		// In parallel, so the page can arrive populated
		const [st, us, ro] = await Promise.all([getStats(), getUsers(), getRooms()]);
		stats = st;
		users = us;
		rooms = ro;
		users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
		await sortChores();
		onReady();
	}

	onMount(load);

	function getDateLabel(day) {
		const d = Number(day);
		if (d < -7) return 'Very overdue';
		if (d < 0) return `${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''} overdue`;
		if (d === 0) return 'Due today';
		if (d === 1) return 'Due tomorrow';
		if (d < 7) return `In ${d} days`;
		if (d < 14) return 'Next week';
		if (d <= 30) return 'Later this month';
		return `In ${d - 30} month${d - 30 !== 1 ? 's' : ''}`;
	}

	function getSectionColor(day) {
		return Number(day) < 0 ? 'var(--urgent)' : 'var(--primary)';
	}

	// Each action folds the panel away first, then reshuffles the list
	async function afterDelChore(id) {
		activeChore = null;
		await Promise.all([delChore({ id }), afterExit()]);
		await sortChores();
		stats = await getStats();
	}

	async function afterSignChore(data) {
		activeChore = null;
		await Promise.all([signChore(data), afterExit()]);
		await sortChores();
		stats = await getStats();
	}

	async function afterSkipChore() {
		const id = activeChore._id;
		activeChore = null;
		await Promise.all([skipChore({ id }), afterExit()]);
		await sortChores();
	}
</script>

<style>
	.page {
		width: 95%;
		margin: 0 auto;
		padding-top: 12px;
		padding-bottom: 120px;
	}

	.search-input {
		width: 100%;
		padding: 10px 14px;
		background-color: var(--paper);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		color: var(--primary);
		font-size: var(--text-base);
		box-sizing: border-box;
		margin-bottom: 4px;
		font-family: inherit;
	}

	.search-input::placeholder {
		color: var(--primary);
		font-style: italic;
	}

	.search-input:focus {
		border-color: var(--primary-deep);
		box-shadow: var(--focus-ring);
	}

	/* Positioned so rows leaving a group stay anchored while the rest glide */
	.day-group {
		position: relative;
	}

	.chore-row {
		width: 100%;
		min-height: 60px;
		border: none;
		font: inherit;
		text-align: left;
		border-radius: var(--radius-md);
		margin-bottom: 8px;
		background-color: var(--primary);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		box-sizing: border-box;
		cursor: pointer;
		transition: background-color var(--dur-fast) var(--ease-out);
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
	}

	@media (hover: hover) {
		.chore-row:hover {
			background-color: var(--primary-deep);
		}
	}

	.chore-row:active {
		background-color: var(--primary-deep);
	}

	.chore-name {
		color: var(--paper);
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
		text-transform: lowercase;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 0;
		padding-right: 10px;
	}

	.chore-name::first-letter {
		text-transform: uppercase;
	}

	.chore-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.last-signer {
		color: var(--paper);
		font-size: var(--text-xs);
		white-space: nowrap;
		text-align: right;
		max-width: 90px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.room-badge {
		background-color: var(--paper);
		color: var(--primary);
		border-radius: var(--radius-pill);
		padding: 4px 10px;
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		white-space: nowrap;
	}

	.skeleton {
		width: 100%;
		min-height: 60px;
		border-radius: var(--radius-md);
		margin-bottom: 8px;
		background: linear-gradient(90deg, var(--primary-a12) 25%, var(--primary-a25) 50%, var(--primary-a12) 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	.empty-msg {
		color: var(--primary);
		font-style: italic;
		padding: 24px 0 12px;
		margin: 0;
	}

	.empty-msg a {
		color: var(--primary);
	}

	/* Phones: the name gets the full width and wraps whole; the last
	 * signer moves underneath it, the room count stays on the right */
	@media (max-width: 480px) {
		.chore-row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			column-gap: 10px;
			row-gap: 2px;
		}

		.chore-name {
			padding-right: 0;
			white-space: normal;
			overflow-wrap: break-word;
			line-height: var(--leading-snug);
		}

		.chore-meta {
			display: contents;
		}

		.last-signer {
			grid-row: 2;
			max-width: none;
			text-align: left;
		}

		.room-badge {
			grid-column: 2;
			grid-row: 1 / span 2;
			align-self: center;
		}
	}
</style>

{#if chores === undefined}
	<div class="page">
		{#each [1, 2, 3, 4] as _}
			<div class="skeleton"></div>
		{/each}
	</div>
{:else if !Object.keys(chores).length}
	<div class="page" in:reveal>
		<p class="empty-msg">
			{#if !users?.length}
				Set up household members in <a href="/settings">Settings</a> first.
			{:else if !rooms?.length}
				Add rooms in Settings, then create your first chore.
			{:else}
				No chores yet. Tap + to add one.
			{/if}
		</p>
	</div>
{:else}
	<div class="page" in:reveal>
		<RoomFilter
			rooms={rooms ?? []}
			selectedRooms={chores_filter}
			onFilterChange={(f) => chores_filter = f}
		/>
		<input
			class="search-input"
			type="search"
			placeholder="Search chores..."
			bind:value={search}
		/>
		{#each sortedDays as day (day)}
			{@const filtered = filterChores(chores[day])}
			{#if filtered.length}
				<!-- Day groups fold away when a search or filter empties them -->
				<div class="day-group" transition:expand>
					<Section title={getDateLabel(day)} color={getSectionColor(day)} />
					{#each filtered as chore (chore._id)}
						<div class="chore-item" animate:move in:reveal out:vanish>
							<button
								class="chore-row on-primary"
								aria-expanded={activeChore?._id === chore._id}
								on:click={() => activeChore = activeChore?._id === chore._id ? null : chore}
							>
								<span class="chore-name">{chore.name}</span>
								<span class="chore-meta">
									<span class="last-signer">Last: {chore.last_sign}</span>
									<span class="room-badge">{chore.rooms.length}<span class="sr-only"> rooms</span></span>
								</span>
							</button>
							{#if activeChore?._id === chore._id}
								<div transition:expand>
									<UpdateTask
										chore={activeChore}
										users={users}
										onSubmit={afterSignChore}
										reset={() => activeChore = null}
										skip={afterSkipChore}
										delFunc={afterDelChore}
									/>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		{/each}
	</div>
{/if}


