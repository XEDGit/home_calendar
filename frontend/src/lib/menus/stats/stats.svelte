<script>
	import { onMount } from "svelte";
	import { getStats, getUsers, getChores, getRooms, delStats } from '../../requests'
	import Chart from 'chart.js/auto'
	import Section from "$lib/header/Section.svelte";
	import Collapsible from "$lib/containers/collapsible.svelte";

	let graph = null
	let chart = null
	let users = null
	let users_by_id = null
	let stats = null
	let stats_per_user = null
	let chores = null
	let chores_by_id = null
	let rooms = null

	let history_len = 5

	async function makeHistogram() {
		let dataset = {}
		let date = new Date()
		date.setDate(date.getDate() - history_len)
		for (let chore of chores) {
			dataset[chore.name] = {}
			for (let user of users) {
				dataset[chore.name][user.name] = 0;
				for (let stat of stats_per_user[user._id]) {
					if (date < new Date(stat.date) && stat.chore_ref == chore._id)
						dataset[chore.name][user.name] += stat.rooms.length;
				}
			}
		}
		dataset = Object.fromEntries(Object.entries(dataset).filter((task) => {return Object.values(task[1]).some((v) => {return v != 0})}))
		let labels = Object.keys(dataset)
		let tasks = []
		for (let user of users) {
			tasks.push({
				label: user.name,
				data: labels.map(task => dataset[task][user.name] || 0),
				borderWidth: 1
			})
		}
		if (chart) {
			chart.destroy()
		}
		chart = new Chart(graph, {
			type: 'bar',
			data: {
				datasets: tasks,
				labels: labels
			},
			options: {
				indexAxis: 'y',
				scales: {
					x: {
						beginAtZero: true
					}
				}
			}
		});
	}

	async function makeChart() {
		let date = new Date()
		let dates = []
		for (let i = 0; i < history_len; i++) {
			const day = String(date.getDate())
			const month = String(date.getMonth() + 1)
			dates.push(`${day}-${month}`)
			date.setDate(date.getDate() - 1)
		}
		dates.reverse()
		let dataset = {}
		for (let d of stats) {
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
					data: Array(history_len).fill(0),
					fill: true,
					backgroundColor: color? color.padEnd(6, '0') + '99' : '#96616B99',
					borderColor: color || '#96616B',
				}
				dataset[d.who].data[idx] += d.rooms.length
			}
		}
		dataset = Object.values(dataset);

		if (chart) {
			chart.destroy()
		}
		chart = new Chart(graph, {
			type: 'line',
			data: {
				labels: dates,
				datasets: dataset,
			},
			options: {
				responsive: true,
				scales: {
					x: {
						ticks: {
							font: {
								size: 10
							},
							maxRotation: 90,
							minRotation: 0,
						}
					},
					y: {
						ticks: {

							font: {
								size: 10
							},
							// Force ticks to display integers only
							callback: function(value) {
								return Number.isInteger(value) ? value : null;
							}
						},
						min: 0,
						suggestedMax: 4,
					}
				},
			}
		});
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

	let chart_func = makeChart;

	onMount(async () => {
		rooms = await getRooms()
		stats = await getStats()
		chores = await getChores()
		chores_by_id = chores.reduce((acc, obj) => {
			const { _id } = obj;
			acc[_id] = obj;
			return acc;
		}, {});
		reduceStats()
		users = await getUsers()
		users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
		graph = document.getElementById('statsGraph').getContext('2d');
		chart_func()
})
</script>

<style>
	.bordered {
		border: solid #96616B 3px;
		border-radius: 5px;
		padding: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 10px;
	}

	.stats {
		max-height: 60vh;
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

	.chartButtons {
		display: flex;
		gap: 10px;
	}

	.active {
		background-color: #FFEAD0;
		border: solid #96616B 3px;
		border-radius: 5px;
		color: #96616B;
	}

	.chartButton {
		background-color: #96616B;
		border: solid #96616B 3px;
		border-radius: 5px;
		color: #FFEAD0;
	}
</style>

<div class='bordered'>
	<div class='chartButtons'>
		<button class={chart_func == makeChart? 'active' : 'chartButton'} on:click={() => {chart_func = makeChart; chart_func()}}>Line</button>
		<button class={chart_func == makeHistogram? 'active' : 'chartButton'} on:click={() => {chart_func = makeHistogram; chart_func()}}>Histogram</button>
	</div>
	<canvas id="statsGraph" class='stats' width="100%" height="40%"></canvas>
	<input class='range' type="range" min="1" max="30" step="1" bind:value={history_len} on:change={(e) => {chart_func(); e.target.max = history_len < 30? 30 : history_len < 60? 60 : history_len < 90? 90 : 180}} />
	<p style='color: #96616B; margin: 0;'>Showing since {history_len} days ago ({new Date(Date.now() - history_len * 24 * 60 * 60 * 1000).toDateString()})</p>
</div>

<div class='bordered'>
	{#each users as user}
		<div class="retro-red user-stats">
			<Section title={user.name} color='#FFEAD0' />
			<Collapsible>
				{#each stats_per_user[user._id].reverse() as stat}
					<div class='single-stat'>
						<p>{chores_by_id[stat.chore_ref].name}</p>
						<div class='right-menu'>
							<p>{stat.rooms.length} rooms</p>
							<p>{new Date(stat.date).toDateString()}</p>
							<button on:click={async () => {await delStats(stat._id); stats = await getStats(); reduceStats()}}>Delete</button>
						</div>
					</div>
				{/each}
			</Collapsible>
		</div>
	{/each}
</div>