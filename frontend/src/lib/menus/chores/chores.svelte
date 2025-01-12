<script>
	import Section from "$lib/header/Section.svelte";
	import UpdateTask from "./updateChore.svelte";
	import { onMount } from "svelte";
	import Chart from 'chart.js/auto'
	import { getStats, getUsers, getChores, signChore, delChore, getRooms } from '$lib/requests'
	import Drag from "$lib/containers/drag.svelte";
    import Button from "$lib/buttons/button.svelte";

	let chores = [];
	let sortedDays = [];
	let stats = null;
	let users = null;
	let users_by_id = null;
	let rooms = null;
	let rooms_by_id = null;

	// Filter shown chores
	let chores_filter = []

	function clearFilter() {
		chores_filter = []
		makeChart()
	}

	function handleFilter(newel) {
		if (chores_filter.includes(newel)) {
			chores_filter = chores_filter.filter(item => item !== newel);
		} else {
			chores_filter = [...chores_filter, newel];
		}
		makeChart()
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

	let graph = null 
	let chart = null

	onMount(async () => {
		stats = await getStats()
		users = await getUsers()
		users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
		rooms = await getRooms()
		rooms_by_id = Object.fromEntries(rooms.map(r => [r._id, r.name]));
		await sortChores()
		const canvas = document.getElementById('statsGraph');
		if (!canvas)
			return;
		graph = canvas.getContext('2d')
		makeChart()
	})

	function getDateLabel(dayNumber) {
		if (dayNumber > 42) {
			return 'Invalid day number';
		}
		if (dayNumber < -7) {
			return `Very late`;
		}
		if (dayNumber < 0 && dayNumber > -7) {
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
		delChore({"id": id})
		chores = sortChores();
		await makeChart()
	}

	async function afterSignChore(data) {
		signChore(data)
		chores = sortChores();
		await makeChart()
	}

	let isOpen = 0;
	let roomChoice = 0;
	function reset() {
		roomChoice = 0;
	}

	async function makeChart() {
		let date = new Date()
		let dates = []
		for (let i = 0; i < 5; i++) {
			const day = String(date.getDate())
			const month = String(date.getMonth() + 1)
			dates.push(`${day}-${month}`)
			date.setDate(date.getDate() - 1)
		}
		dates.reverse()
		stats = await getStats()
		let dataset = {}
		for (let d of filterStats(stats, chores_filter)) {
			date = new Date(d.date)
			const day = String(date.getDate())
			const month = String(date.getMonth() + 1)
			date = `${day}-${month}`
			let idx = dates.findIndex((cmp_date) => {return date == cmp_date})
			if (idx == -1)
				continue;
			if (d.who in dataset) {
				dataset[d.who].data[idx] += d.rooms.length
			}
			else {
				const color = users_by_id[d.who].color
				dataset[d.who] = {
					label: users_by_id[d.who].name,
					data: Array(5).fill(0),
					fill: true,
					backgroundColor: color? color.padEnd(6, '0') + '99' : '#96616B99',
					borderColor: color || '#96616B99',
				}
				dataset[d.who].data[idx] += d.rooms.length
			}
		}

		dataset = Object.values(dataset)

		if (chart) {
			chart.data.datasets = []
			chart.data.datasets.push(...dataset)
			chart.update()
		}
		else {
			chart = new Chart(graph, {
				type: 'line',
				data: {
					labels: dates,
					datasets: dataset,
				},
				options: {
					responsive: true,
					scales: {
						y: {
							ticks: {
								// Force ticks to display integers only
								callback: function(value) {
									return Number.isInteger(value) ? value : null; // Show only integers
								}
							}
						}
					},
				}
			});
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

	.stats {
		border: solid #96616B 3px;
		border-radius: 5px;
		max-height: 25vh;
	}

	.filter-bar {
		width: 100%;
		padding: 10px 0;
		display: flex;
		gap: 5px;
		flex-wrap: wrap;
		color: #96616B;
		align-items: center;
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

{#if chores}
<Section title='Stats' />
<canvas id="statsGraph" class='stats'></canvas>
<p style='color: #96616B; margin: 0; margin-top: 10px; font-weight: bold; text-decoration: underline;'>Show:</p>
<div class='filter-bar'>
	<Button title='All' func={clearFilter} inverted={true} active={chores_filter.length == 0} />
	{#each rooms as room}
		<Button title={room.name} func={handleFilter} inverted={true} active={chores_filter.includes(room.name)} />
	{/each}
</div>
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
					<UpdateTask chore={chore} onSubmit={(updateChore) => {afterSignChore(updateChore); reset();}} reset={reset} delFunc={afterDelChore} />
				{/if}
			</div>
		{/each}
	{/if}
{/each}
{:else}
	<p>Loading...</p>
{/if}
