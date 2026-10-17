<script>
	import { onMount, tick } from "svelte";
	import { getStats, getUsers, getChores, getEvents, getRooms, delStats } from '../../requests'
	import Section from "#lib/header/Section.svelte";
	import Collapsible from "#lib/containers/collapsible.svelte";
    import SelectButtons from "#lib/buttons/selectButtons.svelte";
    import LineChart from "#lib/charts/lineChart.svelte";
    import BarChart from "#lib/charts/barChart.svelte";
    import RoomFilter from "#lib/filters/roomFilter.svelte";
    import ContentLayout from "#lib/containers/contentLayout.svelte";
	import { reveal } from "#lib/motion.js";
	import { currentPrimary } from "#lib/theme.js";
    import HouseholdStats from "#lib/components/HouseholdStats.svelte";

	let users = null;
	let users_by_id = null;
	let stats = null;
	let stats_per_user = null;
	let chores = null;
	let chores_by_id = null;
	let rooms = null;
	let rooms_by_id = null;
	let events = null; // Added variable declaration

	let chartType = 'line';
	let chores_filter = [];
	let lineChartComponent;
	let barChartComponent;
	let lineDatasets = [];
	let lineLabels = [];
	let barDatasets = [];
	let barLabels = [];
	
	// Kept alive in the background between visits: coming back to this tab
	// refreshes it in place
	// Called once the first data is in, so the page knows this tab can
	// slide in whole
	export let onReady = () => {};
	export let active = true;
	let wasActive = active;
	$: onActiveChange(active);
	function onActiveChange(isActive) {
		if (isActive && !wasActive && stats) load();
		wasActive = isActive;
	}

	// The graph covers the range picked in the household stats above it
	let rangeStart = null;
	let rangeEnd = null;

	function handleRangeChange(start, end) {
		rangeStart = start;
		rangeEnd = end;
		updateCharts();
	}

	function filterStats(stats_list, chores_filter) {
		if (chores_filter.length) {
			stats_list = stats_list.filter((stat) => {return stat.rooms.some((room) => {return chores_filter.includes(rooms_by_id[room]);})})
		}
		return stats_list;
	}

	function handleFilterChange(newFilter) {
		chores_filter = newFilter;
		updateCharts();
	}

	function updateCharts() {
		if (!rangeStart) return;
		if (chartType === 'line') {
			prepareLineChartData();
			if (lineChartComponent) {
				lineChartComponent.updateChart(lineDatasets, lineLabels);
			}
		} else {
			prepareBarChartData();
			if (barChartComponent) {
				barChartComponent.updateChart(barDatasets, barLabels);
			}
		}
	}

	function dayKey(date) {
		return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
	}

	function prepareLineChartData() {
		// One point per day of the range
		let days = [];
		for (let date = new Date(rangeStart); date <= rangeEnd; date.setDate(date.getDate() + 1)) {
			days.push(new Date(date));
		}
		const day_index = Object.fromEntries(days.map((day, i) => [dayKey(day), i]));
		
		let dataset = {};
		for (let d of filterStats(stats, chores_filter)) {
			const idx = day_index[dayKey(new Date(d.date))];
			if (idx === undefined) continue;
			
			if (d.who in dataset) {
				if (chores_filter.length) {
					dataset[d.who].data[idx] += d.rooms.filter(room => chores_filter.includes(rooms_by_id[room])).length;
				} else {	
					dataset[d.who].data[idx] += d.rooms.length;
				}
			} else {
				const color = users_by_id[d.who].color;
				dataset[d.who] = {
					label: users_by_id[d.who].name,
					data: Array(days.length).fill(0),
					fill: true,
					backgroundColor: color ? color.padEnd(6, '0') + '99' : currentPrimary() + '99',
					borderColor: color || currentPrimary(),
				};
				
				if (chores_filter.length) {
					dataset[d.who].data[idx] += d.rooms.filter(room => chores_filter.includes(rooms_by_id[room])).length;
				} else {	
					dataset[d.who].data[idx] += d.rooms.length;
				}
			}
		}
		
		lineDatasets = Object.values(dataset);
		lineLabels = days.map(day => `${day.getDate()}-${day.getMonth() + 1}`);
	}

	function prepareBarChartData() {
		let dataset = {};
		for (let chore of chores) {
			dataset[chore.name] = {};
			for (let user of users) {
				dataset[chore.name][user.name] = 0;
				for (let stat of filterStats(stats_per_user[user._id] || [], chores_filter)) {
					const stat_date = new Date(stat.date);
					if (stat_date >= rangeStart && stat_date <= rangeEnd && stat.chore_ref == chore._id) {
						if (chores_filter.length) {
							dataset[chore.name][user.name] += stat.rooms.filter(room => chores_filter.includes(rooms_by_id[room])).length;
						} else {	
							dataset[chore.name][user.name] += stat.rooms.length;
						}
					}
				}
			}
		}
		
		dataset = Object.fromEntries(Object.entries(dataset).filter((task) => {
			return Object.values(task[1]).some((v) => {return v != 0});
		}));
		
		let labels = Object.keys(dataset);
		let tasks = [];
		for (let user of users) {
			tasks.push({
				label: user.name,
				data: labels.map(task => dataset[task][user.name] || 0),
				borderWidth: 1,
				backgroundColor: user.color ? user.color.padEnd(6, '0') + '99' : currentPrimary() + '99',
				borderColor: user.color || currentPrimary(),
			});
		}
		
		barDatasets = tasks;
		barLabels = labels;
	}

	function reduceStats() {
		stats_per_user = stats.reduce((acc, obj) => {
			const { who } = obj;
			if (!acc[who])
				acc[who] = [];
			acc[who].push(obj);
			return acc;
		}, {});
	}

	async function load() {
		// In parallel, so the page can arrive populated
		const [ro, fetchedStats, ev, ch, us] = await Promise.all([
			getRooms(), getStats(), getEvents(), getChores(), getUsers()
		]);
		rooms = ro;
		events = ev;
		chores = ch;
		users = us;
		rooms_by_id = Object.fromEntries(rooms.map(r => [r._id, r.name]));
		chores_by_id = chores.reduce((acc, obj) => {
			const { _id } = obj;
			acc[_id] = obj;
			return acc;
		}, {});
		
		users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
		// Assigned last: the page renders once everything it needs is here
		stats = fetchedStats;
		reduceStats();

		// The chart mounts once stats render
		await tick();
		updateCharts();
		onReady();
	}

	onMount(load);
</script>

<style>
	.tooltip {
		text-transform: none;
		color: var(--primary);
		font-style: italic;
		white-space: wrap;
	}

	.bordered {
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-lg);
		padding: var(--space-sm);
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 10px;
	}

	.user-stats {
		color: var(--paper);
		width: 90%;
		border-radius: var(--radius-md);
		padding: var(--space-sm);
		margin-bottom: var(--space-sm);
	}

	.single-stat {
		font-size: var(--text-xs);
		display: flex;
		margin: 0;
		justify-content: space-between;
		gap: 10px;
	}

	.right-menu {
		display: flex;
		gap: 10px;
	}

	.right-menu>button {
		background-color: var(--paper);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		color: var(--primary);
		padding: var(--chip-pad-y) var(--chip-pad-x);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.right-menu>button:hover {
			background-color: var(--primary);
			color: var(--paper);
		}
	}

</style>

<ContentLayout
	loading={!stats}
	empty={stats?.length === 0}
	emptyMessage="No statistics have been found"
	emptyAction="Finish a task in the <a href='/chores'>Chores tab</a> and sign it for any amount of rooms to start watching your progress"
>
	{#if stats?.length}
		{#if stats && users && rooms && events && users_by_id && rooms_by_id}
			<!-- Statistics Section -->
			<HouseholdStats 
				stats={stats}
				users={users}
				rooms={rooms}
				events={events}
				chores={chores}
				users_by_id={users_by_id}
				rooms_by_id={rooms_by_id}
				onRangeChange={handleRangeChange}
			/>
		{/if}
		<!-- Chart Section -->
		<div>
			<SelectButtons 
				hooks={{
					"Line": () => {chartType = 'line'; updateCharts();},
					"Bars": () => {chartType = 'bars'; updateCharts();}
				}} 
			/>
			
			{#if chartType === 'line'}
				<div in:reveal>
					<LineChart 
						datasets={lineDatasets} 
						labels={lineLabels} 
						height="50vh"
						bind:this={lineChartComponent} 
					/>
				</div>
			{:else}
				<div in:reveal>
					<BarChart 
						datasets={barDatasets} 
						labels={barLabels} 
						height="50vh"
						bind:this={barChartComponent} 
					/>
				</div>
			{/if}
			
			<RoomFilter 
				rooms={rooms} 
				selectedRooms={chores_filter} 
				onFilterChange={handleFilterChange} 
			/>
		</div>

		<div class='bordered'>
			{#each users as user}
				<div class="retro-red user-stats">
					<Section title={user.name} color='var(--paper)' />
					<Collapsible>
						{#if stats_per_user[user._id]}
						{#each stats_per_user[user._id].reverse() as stat}
							<div class='single-stat'>
								<p>{chores_by_id[stat.chore_ref].name}</p>
								<div class='right-menu'>
									<p>{stat.rooms.length} rooms</p>
									<p>{new Date(stat.date).toDateString()}</p>
									<button on:click={async () => {
										await delStats(stat._id); 
										stats = await getStats(); 
										reduceStats();
										updateCharts();
									}}>Delete</button>
								</div>
							</div>
						{/each}
						{:else}
							<p class='tooltip'>Nothing to show</p>
						{/if}
					</Collapsible>
				</div>
			{/each}
		</div>
	{/if}
</ContentLayout>