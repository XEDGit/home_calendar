<script>
	import Section from "$lib/header/Section.svelte";
	import UpdateTask from "./updateChore.svelte";
	import { onMount } from "svelte";
	import { getStats, getUsers, getChores, signChore, delChore, getRooms } from '$lib/requests'
	import Drag from "$lib/containers/drag.svelte";
    import Button from "$lib/buttons/button.svelte";
    import LineChart from "$lib/charts/lineChart.svelte";
    import RoomFilter from "$lib/filters/roomFilter.svelte";
    import ContentLayout from "$lib/containers/contentLayout.svelte";

	let chores = undefined;
	let sortedDays = [];
	let stats = null;
	let users = null;
	let users_by_id = null;
	let rooms = null;
	let rooms_by_id = null;

	// Filter shown chores
	let chores_filter = [];
	let lineChartComponent;
	let chartDatasets = [];
	let chartLabels = [];
	
	// Variables for time navigation
	let currentOffset = 0; // Number of days to offset from current date (negative for past, positive for future)
	let historyLen = 5; // Number of days to show in the chart

	function handleFilterChange(newFilter) {
		chores_filter = newFilter;
		makeChart();
	}

	function filterChores(chores_list, chores_filter) {
		if (chores_filter.length) {
			chores_list = chores_list.filter((chore) => {return chore.rooms.some((room) => {return chores_filter.includes(room.name);})})
		}
		return chores_list;
	}

	function filterStats(stats_list, chores_filter) {
		if (chores_filter.length) {
			stats_list = stats_list.filter((stat) => {return stat.rooms.some((room) => {return chores_filter.includes(rooms_by_id[room]);})})
		}
		return stats_list;
	}
	
	// Navigate backward in time
	function navigateBackward() {
		currentOffset -= historyLen;
		makeChart();
	}

	// Navigate forward in time
	function navigateForward() {
		currentOffset += historyLen;
		if (currentOffset > 0) currentOffset = 0; // Don't navigate into the future
		makeChart();
	}

	// Reset to current time
	function resetTimeNavigation() {
		currentOffset = 0;
		makeChart();
	}

	async function sortChores() {
		const sorted_stats = stats.sort((a, b) => {return a.date < b.date})
		let res = await getChores()
		let perDay = res.reduce((acc, chore, index) => {
			chore.last_sign = users_by_id[sorted_stats.find((stat) => {return stat.chore_ref == chore._id})?.who]?.name || 'Nobody'
			if (!acc[chore.nextTime]) {
				acc[chore.nextTime] = [];
			}
			acc[chore.nextTime].push(chore);
			return acc;
		}, {});
		let final = {}
		for (let day of Object.keys(perDay)) {
			if (7 <= day && day < 14) {
				let week = 7;
				if (!final[week])
					final[week] = [];
				final[week].push(...perDay[day]);
			} else if (14 < day && day <= 30) {
				let after = 14;
				if (!final[after])
					final[after] = [];
				final[after].push(...perDay[day]);
			} else if (day < -7) {
				let very_late = -8;
				if (!final[very_late])
					final[very_late] = [];
				final[very_late].push(...perDay[day]);
			} else if (day > 42) {
				let after = 43;
				if (!final[after])
					final[after] = [];
				final[after].push(...perDay[day]);
			} else {
				if (!final[day])
					final[day] = [];
				final[day].push(...perDay[day]);
			}
		}
		chores = final
		sortedDays = Object.keys(chores).sort((a, b) => {return a - b})
	}

	onMount(async () => {
		stats = await getStats()
		users = await getUsers()
		users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
		rooms = await getRooms()
		rooms_by_id = Object.fromEntries(rooms.map(r => [r._id, r.name]));
		await sortChores()
		if (stats?.length) {
			makeChart()
		}
	})

	function getDateLabel(dayNumber) {
		if (dayNumber > 42) {
			return 'Invalid day number';
		}
		if (dayNumber < -7) {
			return `Very late`;
		}
		if (dayNumber < 0 && dayNumber >= -7) {
			return `Late by ${Math.abs(dayNumber)} days`;
		}
		else if (dayNumber == 0) {
			return 'Today';
		} else if (dayNumber == 1) {
			return 'Tomorrow';
		} else if (7 <= dayNumber && dayNumber < 14) {
			return 'Next week';
		} else if (dayNumber < 7) {
			return `In ${dayNumber} days`;
		}  else if (dayNumber < 30) {
			return `Later this month`;
		} else {
			return `In ${dayNumber - 30} month${(dayNumber - 30 > 1) ? 's' : ''}`;
		}
	}

	async function afterDelChore(id) {
		await delChore({"id": id})
		chores = await getChores()
		await sortChores();
		stats = await getStats();
		makeChart()
	}

	async function afterSignChore(data) {
		await signChore(data);
		await sortChores();
		stats = await getStats();
		makeChart();
	}

	let isOpen = 0;
	let roomChoice = 0;
	function reset() {
		roomChoice = 0;
	}

	function makeChart() {
		if (!stats || !rooms_by_id)
			return;
            
		let date = new Date();
		// Apply the offset for time navigation
		date.setDate(date.getDate() + currentOffset);
		
		let dates = [];
		for (let i = 0; i < historyLen; i++) {
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
				dataset[d.who].data[idx] += d.rooms.length;
			} else {
				const color = users_by_id[d.who].color;
				dataset[d.who] = {
					label: users_by_id[d.who].name,
					data: Array(historyLen).fill(0),
					fill: true,
					backgroundColor: color? color.padEnd(6, '0') + '99' : '#96616B99',
					borderColor: color || '#96616B',
				};
				dataset[d.who].data[idx] += d.rooms.length;
			}
		}

		chartDatasets = Object.values(dataset);
		chartLabels = dates;
		
		if (lineChartComponent) {
			lineChartComponent.updateChart(chartDatasets, chartLabels);
		}
	}
</script>

<style>
	p {
		white-space: nowrap;
		text-transform: lowercase;
	}
	p::first-letter {
		text-transform: uppercase;
	}

	.tooltip {
		text-transform: none;
		color: gray;
		font-style: italic;
		white-space: wrap;
	}
	.choreContainer {
		position: relative;
		width: 90%;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		color: #FFEAD0;
		align-items: flex-end;
		z-index: 0;
		cursor: pointer;
		transition: z-index 0s;
	}

	.info-right {
		float: right;
		right: 0px;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 10px;
		justify-content: center;
		padding-right: 10px;
		position: relative;
	}

	.urgency-indicator {
		height: 10px;
		border: none;
		width: 7vw;
		min-width: 30px;
		margin: 0 0;
		border-radius: 10px;
		max-width: 70px;
	}

	.rep-text .room-text {
		text-align: right;
		font-size: 16px;
	}

	.choreName {
		float:left;
		padding-left: 10px;
		max-width: 40%;
		min-width: 40%;
		overflow: hidden;
		white-space: nowrap;
		display: flex;
		flex-direction: row;
		position: relative;
		align-items: center;
	}

	.fade {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		height: 80%;
		width: 10%;
		pointer-events: none;
		background: linear-gradient(to left, #96616B, transparent);
	}

	.menu-container {
		position: relative;
		left: 0;
		width: 50px;
		text-align: center;
	}

	.menu-button {
		background: none;
		border: none;
		font-size: 2em;
		color: #FFEAD0;
		cursor: pointer;
	}

	.menu-button:hover {
		color: white;
		transform: scale(1.1);
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
	
	.range-container {
		width: 100%;
		text-align: center;
		margin-top: 10px;
	}
	
	.range {
		background-color: #96616B;
	}

	@media (max-width: 1000px) {
		.rep-text {
			display: none;
			position: absolute;
		}
		.room-text {
			font-size: 12px;
			text-align: right;
			align-content: center;
		}
	}

	@media (min-width: 700px) {
		.choreName {
			max-width: 60%;
			min-width: 60%;
		}
	}
</style>

<ContentLayout 
	loading={chores === undefined}
	empty={chores !== undefined && !Object.keys(chores).length}
	emptyMessage={!users?.length 
		? "Welcome to Home-Calendar!" 
		: !rooms?.length 
		? "Nice you're almost there!" 
		: "Ok all the settings are set up, now you can press the + button on the bottom right and start adding tasks"
	}
	emptyAction={!users?.length 
		? "Please enter the <a href='/settings'>Settings tab</a> to set up your home users" 
		: !rooms?.length 
		? "Please enter the settings to set up the rooms in your house" 
		: "I will take care of reminding you when you need to do them!"
	}
>
	{#if stats?.length}
		<Section title='Stats' subtitle='chores activity' />
		
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
				Viewing data from {Math.abs(currentOffset) + historyLen} to {Math.abs(currentOffset)} days ago
			</p>
		{/if}
		
		<LineChart 
			datasets={chartDatasets} 
			labels={chartLabels}
			bind:this={lineChartComponent} 
		/>
		
		<div class="range-container">
			<p style='color: #96616B; margin: 0;'>
				Showing {historyLen} days {currentOffset === 0 ? '' : `(offset by ${-currentOffset} days)`}
			</p>
			<input 
				class='range' 
				type="range" 
				min="3" 
				max="14" 
				step="1" 
				bind:value={historyLen} 
				on:change={makeChart} 
			/>
		</div>
		
		<RoomFilter 
			rooms={rooms} 
			selectedRooms={chores_filter} 
			onFilterChange={handleFilterChange} 
		/>
	{/if}
	
	{#each sortedDays as day}
		{#if (filterChores(chores[day], chores_filter)).length}
			<Section title={getDateLabel(day)} />
			{#each filterChores(chores[day], chores_filter) as chore}
				<div class='choreContainer' style='z-index: {roomChoice == chore._id || isOpen == chore._id ? '1' : '0'};' on:click={() => {if (roomChoice != chore._id) roomChoice = chore._id; isOpen = 0}}>
					<Drag>
						<div class="choreName">
							<p>{chore.name}</p>
							<div class='fade'></div>
						</div>
						<div class='info-right'>
							<small style="font-size: 0.5em; margin: 0; margin-left: 10px; margin-top: 0.25em">Last signed by <small style="font-size: 1.3em;">{chore.last_sign}</small></small>
							<p class='room-text'>{chore.rooms.length} rooms</p>
							<hr class='urgency-indicator' style="background-color: {chore.nextTime < -2? '#DB324D' : chore.nextTime <= -1? 'orange' : chore.nextTime == 0? 'green' : 'gray'}" />
						</div>
					</Drag>
					{#if roomChoice == chore._id}
						<UpdateTask 
							chore={chore} 
							users={users}
							onSubmit={(updateChore) => {afterSignChore(updateChore); reset();}} 
							reset={reset} 
							delFunc={afterDelChore} 
						/>
					{/if}
				</div>
			{/each}
		{/if}
	{/each}
</ContentLayout>
