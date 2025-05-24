<script>
	import { onMount } from "svelte";
	import { getStats, getUsers, getChores, getEvents, getRooms, delStats } from '../../requests'
	import Section from "$lib/header/Section.svelte";
	import Collapsible from "$lib/containers/collapsible.svelte";
    import SelectButtons from "$lib/buttons/selectButtons.svelte";
    import LineChart from "$lib/charts/lineChart.svelte";
    import BarChart from "$lib/charts/barChart.svelte";
    import RoomFilter from "$lib/filters/roomFilter.svelte";
    import ContentLayout from "$lib/containers/contentLayout.svelte";
    import HouseholdStats from "$lib/components/HouseholdStats.svelte";

	let users = null;
	let users_by_id = null;
	let stats = null;
	let stats_per_user = null;
	let chores = null;
	let chores_by_id = null;
	let rooms = null;
	let rooms_by_id = null;
	let events = null; // Added variable declaration

	let history_len = 5;
	let chartType = 'line';
	let chores_filter = [];
	let lineChartComponent;
	let barChartComponent;
	let lineDatasets = [];
	let lineLabels = [];
	let barDatasets = [];
	let barLabels = [];
	
	// Variables for time navigation
	let currentOffset = 0; // Number of days to offset from current date (negative for past, positive for future)

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

	// Navigate backward in time
	function navigateBackward() {
		currentOffset -= history_len;
		updateCharts();
	}

	// Navigate forward in time
	function navigateForward() {
		currentOffset += history_len;
		if (currentOffset > 0) currentOffset = 0; // Don't navigate into the future
		updateCharts();
	}

	// Reset to current time
	function resetTimeNavigation() {
		currentOffset = 0;
		updateCharts();
	}

	function updateCharts() {
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

	function prepareLineChartData() {
		let date = new Date();
		// Apply the offset for time navigation
		date.setDate(date.getDate() + currentOffset);
		
		let dates = [];
		for (let i = 0; i < history_len; i++) {
			const day = String(date.getDate());
			const month = String(date.getMonth() + 1);
			dates.push(`${day}-${month}`);
			date.setDate(date.getDate() - 1);
		}
		dates.reverse();
		
		let dataset = {};
		for (let d of filterStats(stats, chores_filter)) {
			date = new Date(d.date);
			const day = String(date.getDate());
			const month = String(date.getMonth() + 1);
			date = `${day}-${month}`;
			let idx = dates.findIndex((cmp_date) => {return date == cmp_date});
			if (idx == -1) continue;
			
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
					data: Array(history_len).fill(0),
					fill: true,
					backgroundColor: color ? color.padEnd(6, '0') + '99' : '#96616B99',
					borderColor: color || '#96616B',
				};
				
				if (chores_filter.length) {
					dataset[d.who].data[idx] += d.rooms.filter(room => chores_filter.includes(rooms_by_id[room])).length;
				} else {	
					dataset[d.who].data[idx] += d.rooms.length;
				}
			}
		}
		
		lineDatasets = Object.values(dataset);
		lineLabels = dates;
	}

	function prepareBarChartData() {
		let dataset = {};
		let date = new Date();
		// Apply the offset for bar chart time navigation
		date.setDate(date.getDate() + currentOffset);
		date.setDate(date.getDate() - history_len);
		
		for (let chore of chores) {
			dataset[chore.name] = {};
			for (let user of users) {
				dataset[chore.name][user.name] = 0;
				for (let stat of filterStats(stats_per_user[user._id] || [], chores_filter)) {
					if (date < new Date(stat.date) && stat.chore_ref == chore._id) {
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
				backgroundColor: user.color ? user.color.padEnd(6, '0') + '99' : '#96616B99',
				borderColor: user.color || '#96616B',
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

	onMount(async () => {
		rooms = await getRooms();
		rooms_by_id = Object.fromEntries(rooms.map(r => [r._id, r.name]));
		stats = await getStats();
		events = await getEvents();
		chores = await getChores();
		chores_by_id = chores.reduce((acc, obj) => {
			const { _id } = obj;
			acc[_id] = obj;
			return acc;
		}, {});
		
		reduceStats();
		users = await getUsers();
		users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
		
		prepareLineChartData();
		lineChartComponent.updateChart(lineDatasets, lineLabels);
	});
</script>

<style>
	.tooltip {
		text-transform: none;
		color: gray;
		font-style: italic;
		white-space: wrap;
	}

	.bordered {
		border: solid #96616B 3px;
		border-radius: 5px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 10px;
	}

	input {
		background-color: #96616B;
	}

	.user-stats {
		color: #FFEAD0;
		width: 90%;
		border-radius: 5px;
		padding: 10px;
		margin-bottom: 10px;
	}

	.single-stat {
		font-size: 10px;
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
		background-color: #FFEAD0;
		border: solid #96616B 3px;
		border-radius: 5px;
		color: #96616B;
	}

	.right-menu>button:hover {
		background-color: #96616B;
		color: #FFEAD0;
	}

	.range-container {
		width: 100%;
		text-align: center;
	}
	
	.navigation-container {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 10px 0;
	}
	
	.nav-button {
		background-color: #FFEAD0;
		border: solid #96616B 2px;
		border-radius: 5px;
		color: #96616B;
		padding: 5px 15px;
		cursor: pointer;
		font-weight: bold;
	}
	
	.nav-button:hover {
		background-color: #96616B;
		color: #FFEAD0;
	}
	
	.nav-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.time-info {
		color: #96616B;
		text-align: center;
		margin: 5px 0;
		font-style: italic;
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
			
			<div class="navigation-container">
				<button class="nav-button" on:click={navigateBackward}>
					← Older
				</button>
				{#if currentOffset !== 0}
					<button class="nav-button" on:click={resetTimeNavigation}>
						Reset
					</button>
				{/if}
				<button class="nav-button" on:click={navigateForward} disabled={currentOffset === 0}>
					Newer →
				</button>
			</div>
			
			{#if currentOffset !== 0}
				<p class="time-info">
					Viewing data from {Math.abs(currentOffset) + history_len} to {Math.abs(currentOffset)} days ago
				</p>
			{/if}
			
			{#if chartType === 'line'}
				<LineChart 
					datasets={lineDatasets} 
					labels={lineLabels} 
					height="50vh"
					bind:this={lineChartComponent} 
				/>
			{:else}
				<BarChart 
					datasets={barDatasets} 
					labels={barLabels} 
					height="50vh"
					bind:this={barChartComponent} 
				/>
			{/if}
			
			<RoomFilter 
				rooms={rooms} 
				selectedRooms={chores_filter} 
				onFilterChange={handleFilterChange} 
			/>
			
			<div class="range-container">
				<p style='color: #96616B; margin: 0; margin-top:10px;'>
					Showing {history_len} days {currentOffset === 0 ? '' : `(offset by ${-currentOffset} days)`}
				</p>
				<input 
					class='range' 
					type="range" 
					min="1" 
					max="30" 
					step="1" 
					bind:value={history_len} 
					on:change={(e) => {
						updateCharts(); 
						e.target.max = history_len < 30 ? 30 : history_len < 60 ? 60 : history_len < 90 ? 90 : 180
					}} 
				/>
			</div>
		</div>

		<div class='bordered'>
			{#each users as user}
				<div class="retro-red user-stats">
					<Section title={user.name} color='#FFEAD0' />
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