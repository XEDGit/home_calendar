<script>
	import ContextMenu from "./contextMenu.svelte";
	import Like from '../assets/like.svg'
	import Section from "./Section.svelte";
	import { onMount } from "svelte";

	let chores;

	function isTouchDevice() {
		return 'ontouchstart' in window;
    }

	function getChores() {
		fetch('api/getChores', {
		method: 'GET',
		}).then(res => {
			res.json().then(json => {
				console.log(json)
				let perDay = json.reduce((acc, chore, index) => {
					if (!acc[chore.nextTime]) {
						acc[chore.nextTime] = [];
					}
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

	function delChore(id) {
		fetch('api/delChore', {
			method: 'POST',
			body: JSON.stringify({"id": id}),
		}).then(() => {
			chores = getChores();
		})
	}

	function signChore(id) {
		fetch('api/signChore', {
			method: 'POST',
			body: JSON.stringify({"id": id}),
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
		position: relative;
		fill: #FFEAD0;
		stroke: none;
		left: 2px;
		top: -1px;
		width: 50px;
		height: 50px;
	}
	.like-container {
		background-color: #96616B;
		border-radius: 50%;
		padding: 7px;
		border: none;
	}
	.like-container:hover {
        box-shadow: 0 7px 15px rgba(0, 0, 0, 0.3);
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
		font-size: 14px;
		align-content: center;
	}

	.rep-text {
		text-align: right;
	}

	.choreName {
		float:left;
		padding-left: 10px;
	}
	
	@media (max-width: 1000px) {
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
	<Section title={getDateLabel(day)} />
	{#each chores[day] as chore}
		<div class='choreContainer'>
			<Drag dragData={{id: chore._id, delete: delChore, sign: signChore}}>
				<div class="choreName">
					<p>{chore.name}</p>
				</div>
				<div class='info-right'>
					<p class='room-text'>{chore.room.name}</p>
					<p class='rep-text'>Every {chore.repetition} {chore.timeMeasure}</p>
					<hr class='urgency-indicator' style="background-color: {chore.nextTime <= 1? '#DB324D' : chore.nextTime <=3? 'orange' : 'green'}" />
					<ContextMenu functions={{id: chore._id, delete: delChore, sign: signChore}} />
				</div>
			</Drag>
			<button aria-label="img" class="like-container" style="display: {isTouchDevice()? 'none' : 'block'}" on:click={signChore(chore._id)}>
				<svg class='like' version="1.0" xmlns="http://www.w3.org/2000/svg"
					width="128.000000pt" height="128.000000pt" viewBox="0 0 128.000000 128.000000"
					preserveAspectRatio="xMidYMid meet"
				>
					<g
						transform="translate(0.000000,128.000000) scale(0.100000,-0.100000)"
					>
						<path d="M664 1186 c-37 -16 -50 -32 -192 -235 l-108 -154 -141 2 c-137 2
						-141 2 -157 -21 -14 -19 -16 -66 -16 -355 0 -407 -14 -373 158 -373 121 0 162
						11 162 46 0 19 2 18 57 -16 l47 -30 244 0 c150 0 251 4 263 10 11 6 67 105
						129 231 89 177 112 231 116 277 11 102 -22 174 -97 212 -32 17 -59 20 -173 20
						l-135 0 20 58 c35 100 41 142 29 193 -14 55 -61 116 -106 135 -41 17 -60 17
						-100 0z m85 -122 c29 -37 27 -63 -19 -198 -41 -122 -42 -156 -5 -170 9 -3 95
						-6 190 -6 168 0 174 -1 189 -22 9 -13 16 -43 16 -70 0 -40 -15 -78 -97 -243
						l-98 -195 -214 0 -215 0 -63 41 -63 41 0 189 0 188 97 138 c53 76 127 182 165
						236 38 53 75 97 83 97 7 0 23 -12 34 -26z m-479 -639 l0 -265 -55 0 -55 0 0
						265 0 265 55 0 55 0 0 -265z"/>
					</g>
				</svg>
			</button>
		</div>
	{/each}
{/each}
{:else}
<p>Loading...</p>
{/if}
