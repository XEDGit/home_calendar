<script>
	import Section from "$lib/header/Section.svelte";
	import UpdateTask from "./updateChore.svelte";
	import KanbanBoard from "$lib/containers/kanbanBoard.svelte";
	import { onMount } from "svelte";
	import { getStats, getUsers, getChores, signChore, delChore, getRooms } from '$lib/requests'
	import Drag from "$lib/containers/drag.svelte";
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

	function handleFilterChange(newFilter) {
		console.log('filters ', chores_filter);
		chores_filter = newFilter;
	}

	function filterChores(chores_list, chores_filter) {
		if (typeof(chores_filter) == "string") {
			chores_list = chores_list.filter((chore) => {return chore.name.toLowerCase().includes(chores_filter.toLowerCase())})
		} else if (chores_filter.length) {
			chores_list = chores_list.filter((chore) => {return chore.rooms.some((room) => {return chores_filter.includes(room.name);})})
		}
		return chores_list;
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
	}

	async function afterSignChore(data) {
		await signChore(data);
		await sortChores();
		stats = await getStats();;
	}

	let isOpen = 0;
	let roomChoice = 0;
	function reset() {
		roomChoice = 0;
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

	.searchbar {
		width: 100%;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 1em;
		color: #96616B;
		margin-bottom: 20px;
	}

	.searchbar input {
		height: 100%;
		padding: 10px;
		margin: 0;
		background-color: #FFEAD0;
		border: 1px solid #96616B;
		border-radius: 5px;
		color: #96616B;
		width: 100%;
	}

	@media (max-width: 1000px) {
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
	<!-- <KanbanBoard
		chores={chores}
	/> -->
	<RoomFilter 
		rooms={rooms} 
		onFilterChange={handleFilterChange} 
		selected={chores_filter}
	/>
	<div class="searchbar">
		<input
			type="text" 
			placeholder="Search chores..." 
			on:input={(e) => {handleFilterChange(e.target.value)}} 
		/>
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
