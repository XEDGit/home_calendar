<script>
	import Section from "./Section.svelte";
	import UpdateTask from "./UpdateTask.svelte";
	import { onMount } from "svelte";
	import Chart from 'chart.js/auto'

	let chores = [];
	let sortedDays = [];

	function isTouchDevice() {
		return 'ontouchstart' in window;
    }

	async function getChores() {
		await fetch('api/getChores', {
		method: 'GET',
		}).then(res => {
			res.json().then(json => {
				let perDay = json.reduce((acc, chore, index) => {
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
			})
		});
	}

	let graph = null 
	let chart = null

	onMount(async () => {
		getChores()
		graph = document.getElementById('statsGraph').getContext('2d');
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

	async function delChore(id) {
		await fetch('api/delChore', {
			method: 'POST',
			body: JSON.stringify({"id": id}),
		})
		chores = getChores();
		await makeChart()
	}

	async function signChore(obj) {
		await fetch('api/signChore', {
			method: 'POST',
			body: JSON.stringify(obj),
		})
		chores = getChores();
		await makeChart()
	}

	let isOpen = 0;
	let roomChoice = 0;
	function reset() {
		roomChoice = 0;
	}
	import Drag from "./drag.svelte";
	
	async function getStats() {
		let res = await fetch('api/getStats', {
			method: 'GET',
		})
		res = await res.json()
		return res
	}

	async function getUsers() {
		let res = await fetch('api/getUsers', {
			method: 'GET',
		})
		res = await res.json()
		return res
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
		let stats = await getStats()
		let users = await getUsers()
		let dict_users = {}
		for (let u of users) {
			dict_users[u._id] = u.name
		}
		console.log('making graph')
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
				dataset[d.who] = {
					label: dict_users[d.who],
					data: Array(5).fill(0),
					fill: true
				}
				dataset[d.who].data[idx] += d.rooms.length
			}
		}

		dataset = Object.values(dataset)

		if (chart) {
			console.log(chart.data.datasets)
			chart.data.datasets = []
			chart.data.datasets.push(...dataset)
			console.log(chart.data.datasets)
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
					}
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
		width: 100%;
		height: 20vh;
		border-radius: 5px;
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
			max-width: 70%;
			min-width: 70%;
		}
	}
</style>

{#if chores}
<Section title={'Stats'} />
<canvas id="statsGraph" class='stats' width="100%" height="40%"></canvas>
{#each sortedDays as day}
	<Section title={getDateLabel(day)} />
	{#each chores[day] as chore}
		<div class='choreContainer' style='z-index: {roomChoice == chore._id || isOpen == chore._id ? '1' : '0'};' on:click={() => {if (roomChoice != chore._id) roomChoice = chore._id; isOpen = 0}}>
			<Drag>
				<div class="choreName">
					<p>{chore.name}</p>
					<div class='fade'></div>
				</div>
				<div class='info-right'>
					<p class='room-text'>{chore.rooms.length} rooms</p>
					<!-- <p class='rep-text'>Every {chore.repetition} {chore.timeMeasure}</p> -->
					<hr class='urgency-indicator' style="background-color: {chore.nextTime < -2? '#DB324D' : chore.nextTime <= -1? 'orange' : chore.nextTime == 0? 'green' : 'gray'}" />
				</div>
			</Drag>
			{#if roomChoice == chore._id}
				<UpdateTask chore={chore} onSubmit={(updateChore) => {signChore(updateChore); reset();}} reset={reset} delFunc={delChore} />
			{/if}
		</div>
	{/each}
{/each}
{:else}
	<p>Loading...</p>
{/if}
