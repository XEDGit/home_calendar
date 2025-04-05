<script>
	import { getChores, getEvents, getUsers } from '$lib/requests';
	import { onMount } from 'svelte';

	let events = undefined;
	let users = undefined;
	let chores = undefined;

	let pastMonth = new Date();
	pastMonth.setMonth(pastMonth.getMonth() - 1)
	let nextMonth = new Date();
	nextMonth.setMonth(nextMonth.getMonth() + 1)
	let currentDate = new Date();
	let monthDays = [];

	const day_names = [
		'M',
		'T',
		'W',
		'T',
		'F',
		'S',
		'S',
	];

	onMount(async () => {
		await generateCalendar(currentDate);
	});

	async function generateCalendar(date) {
		events = await getEvents();
		chores = await getChores();
		users = await getUsers();

		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const pastMonthlastDay = new Date(year, month, 0);

		monthDays = [];

		// Fill the monthDays array with slots for previous month
		for (let i = 1; i < firstDay.getDay(); i++) {
			monthDays.push(new Date(year, month - 1, pastMonthlastDay.getDate() - 5 + i));
		}

		// Add the days of the month
		for (let day = 1; day <= lastDay.getDate(); day++) {
			monthDays.push(new Date(year, month, day));
		}

		// // Fill the monthDays array with slots for next month
		for (let i = lastDay.getDay(); i < 14; i++) {
			monthDays.push(new Date(year, month + 1, i - lastDay.getDay() + 1));
		}
	}

	function getEventsForDate(date) {
		let day_events = events.filter((event) => {return new Date(event.when).toDateString() === date.toDateString()});
		console.log(day_events)
		return day_events
	}
	</script>

	<style>
	.calendar {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 10px;
		margin: 20px 0;
	}

	.day {
		border: 1px solid #96616b;
		padding: 10px;
		position: relative;
		height: 150px;
		color: #96616b;
		border-radius: 5px;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
	}

	.day-header {
		color: #96616b;
		font-weight: bold;
		text-align: center;
		margin-bottom: 5px;
	}

	.day-name {
		color: #96616b;
		text-align: center;
	}

	.event {
		background-color: #96616b;
		color: #FFEAD0;
		border-radius: 3px;
		padding: 5px;
		margin-top: 5px;
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.event:hover {
		background-color: #0056b3;
	}
	</style>

	<div>
	<h2 class='day-header'>{currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}</h2>
	<div class="calendar">
		{#each day_names as day_name}
			<small class="day-name">{day_name}</small>
		{/each}
		{#each monthDays as day}
		<div class="day">
			{#if day}
			<div class="day-header">{day.getDate()}</div>
			{#each getEventsForDate(day) as event}
				<div class="event">
					{event.title}
					<small>
						<!-- {new Date(event.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - 
						{new Date(event.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} -->
					</small>
				</div>
			{/each}
			{/if}
		</div>
		{/each}
	</div>
	</div>
