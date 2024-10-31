<script>
	import ContextMenu from "./contextMenu.svelte";
	import Like from '../assets/like.png'
	import { onMount } from "svelte";

	let chores;

	function getChores() {
		fetch('api/getChores', {
		method: 'GET',
		}).then(res => {
			res.json().then(json => {
				let perDay = json.reduce((acc, chore, index) => {
					if (!acc[chore.nextTime]) {
						acc[chore.nextTime] = [];
					}
					chore.id = index;
					acc[chore.nextTime].push(chore);
					return acc;
				}, {});
				let final = {}
				for (let day of Object.keys(perDay)) {
					// perDay[day].sort((a, b) => {return a.room.toLowerCase().localeCompare(b.room.toLowerCase())})
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
					} else {
						if (!final[day])
							final[day] = [];
						final[day].push(...perDay[day]);
					}
				}
				chores = final
			})
		});
	}

	onMount(() => {
		getChores()
	})

	function getDateLabel(dayNumber) {
		if (dayNumber > 42) {
			return 'Invalid day number';
		}
		if (dayNumber < -7) {
			return `Very late`;
		}
		if (dayNumber < 0 && dayNumber > -7) {
			return `Late by ${dayNumber} days`;
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

	function delChore(index) {
		fetch('api/delChore', {
			method: 'POST',
			body: JSON.stringify({"id": index}),
		}).then(() => {
			chores = getChores();
		})
	}

	function signChore(index) {
		fetch('api/signChore', {
			method: 'POST',
			body: JSON.stringify({"id": index}),
		}).then(() => {
			chores = getChores();
		})
	}

	import Drag from "./drag.svelte";
</script>

<style>
	p {
		white-space: nowrap;
		text-transform: lowercase;
	}
	p::first-letter {
		text-transform: uppercase;
	}
	.like {
		position:relative;
		left: 5px;
		top: 1px;
		width: 50px;
		height: 50px;
	}
	.like-container {
		background-color: #96616B;
		border-radius: 50%;
		width: 60px;
		height: 60px;
		transition: background-color 0.5s;
	}
	.like-container:hover {
		background-color: rgb(116, 189, 93);
	}
	.choreContainer {
		width: 90%;
		margin: 0 auto;
		display: flex;
		gap: 10px;
		flex-direction: row;
		color: #FFEAD0;
		align-items: center;
		justify-content: center;
	}
	.info-right {
		float: right;
		right: 0px;
		display: grid;
		grid-template-columns: 1fr 1fr 0.3fr 0.1fr;
		grid-template-rows: 1fr;
		gap: 10px;
		justify-content: center;
		/* justify-content: space-between; */
		padding-right: 10px;
		position: relative;
	}
	.urgency-indicator {
		height: 10px;
		border: none;
		width: 7vw;
		min-width: 30px;
		top: 28px;
		position: relative;
		margin: 0 0;
		border-radius: 10px;
	}

	.room-text {
		text-align: right;
	}

	.rep-text {
		text-align: right;
	}
	
	@media (max-width: 1000px) {
		.like-container {
			display: none;
		}
		.rep-text {
			display: none;
			position: absolute;
		}
		.info-right {
			display: grid;
			grid-template-columns: 1fr 0.3fr 0.1fr;
			grid-template-rows: 1fr;
		}
	}
</style>

{#if chores}
{#each Object.keys(chores) as day}
	<h2>{getDateLabel(day)}</h2>
	<hr />
	{#each chores[day] as chore}
		<div class='choreContainer'>
			<Drag dragData={{id: chore.id, delete: delChore, sign: signChore}}>
				<div style="float:left; padding-left: 10px">
					<p>{chore.name}</p>
				</div>
				<div class='info-right'>
					<p class='room-text'>{chore.room}</p>
					<p class='rep-text'>Every {chore.repetition} {chore.timeMeasure}</p>
					<hr class='urgency-indicator' style="background-color: {chore.nextTime <= 1? '#DB324D' : chore.nextTime <=3? 'orange' : 'green'}" />
					<ContextMenu functions={{id: chore.id, delete: delChore}} />
				</div>
			</Drag>
			<button aria-label="img" class="like-container" on:click={signChore(chore.id)}>
				<img alt="Mark done" class="like" src={Like} />
			</button>
		</div>
	{/each}
{/each}
{:else}
<p>Loading...</p>
{/if}
