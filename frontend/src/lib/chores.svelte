<script>
	import ContextMenu from "./contextMenu.svelte";

	let chores;

	function getChores() {
		fetch('api/getChores', {
		method: 'GET',
		}).then(res => {
			res.json().then(json => {
				let perRoom = json.flatMap(chore =>
					chore.rooms.map(room => ({
						name: chore.name,
						room: room,
						nextTime: chore.nextTime,
					}))
				)
				let perDay = perRoom.reduce((acc, chore) => {
					if (!acc[chore.nextTime]) {
						acc[chore.nextTime] = [];
					}
					acc[chore.nextTime].push(chore);
					return acc;
				}, {});
				let final = {}
				for (let day of Object.keys(perDay)) {
					perDay[day].sort((a, b) => {return a.room.toLowerCase().localeCompare(b.room.toLowerCase())})
					if (7 <= day && day < 14) {
						let week = 7;
						if (!final[week])
							final[week] = []
						final[week].push(...perDay[day])
					} else if (14 < day && day <= 30) {
						let after = 14;
						if (!final[after])
							final[after] = []
						final[after].push(...perDay[day])
					} else {
						if (!final[day])
							final[day] = []
						final[day].push(...perDay[day])
					}
				}
				chores = final
			})
		});
	}

	getChores()

	function getDateLabel(dayNumber) {
		if (dayNumber < 1 || dayNumber > 42) {
			return 'Invalid day number';
		}
		if (dayNumber == 0) {
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
</script>

{#if chores}
{#each Object.keys(chores) as day}
	<h2>{getDateLabel(day)}</h2>
	<hr />
	{#each chores[day] as chore}
		<div class='choreContainer' style="
			width: 90%;
			margin: 0 auto;
			display: flex;
			flex-direction: column;
			align-items: center;">
			<div style="width: 90%; height: 10vh; border-radius: 5px;; background-color: #D0A7EB; margin-bottom: 10px; align-content: center;">
				<div style="float:left; padding-left: 10px">
					<p>{chore.name}</p>
				</div>
				<div style="float:right; display: flex; flex-direction: row-reverse; gap: 10%; padding-right: 10px">
					<ContextMenu />
					<p>{chore.room}</p>
				</div>
			</div>
		</div>
	{/each}
{/each}
{:else}
<p>Loading...</p>
{/if}
