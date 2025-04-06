<script>
	import { getChores, getEvents, getUsers } from '$lib/requests';
	import { onMount } from 'svelte';
	import UpdateEvent from './updateEvent.svelte';
	import Section from "$lib/header/Section.svelte";

	let events = undefined;
	let users = undefined;
	let chores = undefined;
	let selectedEvent = null;

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

		currentDate = new Date(date);
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
		if (!events) return [];
		let day_events = events.filter((event) => {return new Date(event.when).toDateString() === date.toDateString()});
		return day_events;
	}

	function navigateToPreviousMonth() {
		const newDate = new Date(currentDate);
		newDate.setMonth(newDate.getMonth() - 1);
		generateCalendar(newDate);
	}

	function navigateToNextMonth() {
		const newDate = new Date(currentDate);
		newDate.setMonth(newDate.getMonth() + 1);
		generateCalendar(newDate);
	}

	function navigateToToday() {
		generateCalendar(new Date());
	}

	function handleEventClick(event) {
		selectedEvent = event;
	}

	function handleEventClose() {
		selectedEvent = null;
	}

	function handleEventUpdated(updatedEvent) {
		// Update the event in the events array
		const index = events.findIndex(e => e._id === updatedEvent._id);
		if (index !== -1) {
			events[index] = updatedEvent;
		}
		generateCalendar(currentDate);
	}

	function handleEventDeleted(eventId) {
		// Remove the event from the events array
		events = events.filter(e => e._id !== eventId);
		generateCalendar(currentDate);
	}

	function handleYearChange(event) {
		const year = parseInt(event.target.value);
		const newDate = new Date(currentDate);
		newDate.setFullYear(year);
		generateCalendar(newDate);
	}

	function handleMonthChange(event) {
		const month = parseInt(event.target.value);
		const newDate = new Date(currentDate);
		newDate.setMonth(month);
		generateCalendar(newDate);
	}

	// Generate array of years for the dropdown (current year ±10 years)
	$: years = Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i);
	
	// Array of months for the dropdown
	const months = [
		{ value: 0, name: 'January' },
		{ value: 1, name: 'February' },
		{ value: 2, name: 'March' },
		{ value: 3, name: 'April' },
		{ value: 4, name: 'May' },
		{ value: 5, name: 'June' },
		{ value: 6, name: 'July' },
		{ value: 7, name: 'August' },
		{ value: 8, name: 'September' },
		{ value: 9, name: 'October' },
		{ value: 10, name: 'November' },
		{ value: 11, name: 'December' }
	];
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
		overflow-y: auto;
	}
	
	.day.other-month {
		opacity: 0.5;
	}

	.day-header {
		color: #96616b;
		font-weight: bold;
		text-align: center;
		margin-bottom: 5px;
	}
	
	.calendar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		background-color: #96616b;
		border-radius: 10px;
		padding: 10px 15px;
		color: #FFEAD0;
	}
	
	.nav-buttons {
		display: flex;
		gap: 10px;
	}
	
	.nav-button {
		background-color: #FFEAD0;
		color: #96616b;
		border: none;
		padding: 8px 15px;
		border-radius: 4px;
		cursor: pointer;
		font-weight: bold;
		transition: background-color 0.3s;
	}
	
	.nav-button:hover {
		background-color: #f0d6b3;
	}
	
	.today-button {
		background-color: #FFEAD0;
		color: #96616b;
		border: 1px solid #7a4e56;
	}
	
	.today-button:hover {
		background-color: #f8e0c0;
	}
	
	.date-selectors {
		display: flex;
		gap: 10px;
	}
	
	select {
		padding: 8px;
		border-radius: 4px;
		border: 1px solid #7a4e56;
		background-color: #FFEAD0;
		color: #96616b;
	}
	
	h2.calendar-title {
		color: #FFEAD0;
		font-weight: bold;
		margin: 0;
	}

	.day-name {
		color: #96616b;
		text-align: center;
		font-weight: bold;
		margin-bottom: 5px;
	}

	.event {
		background-color: #96616b;
		color: #FFEAD0;
		border-radius: 5px;
		padding: 8px;
		margin-top: 5px;
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.3s;
	}

	.event:hover {
		background-color: #7a4e56;
	}
	
	.calendar-container {
		margin: 0 15px;
	}
	
	.date-display {
		font-size: 18px;
		font-weight: bold;
	}
</style>

<div class="calendar-container">
	<Section title="Calendar" />
	
	<div class="calendar-header">
		<div class="nav-buttons">
			<button class="nav-button" on:click={navigateToPreviousMonth}>Previous</button>
			<button class="nav-button today-button" on:click={navigateToToday}>Today</button>
			<button class="nav-button" on:click={navigateToNextMonth}>Next</button>
		</div>
		
		<div class="date-display">
			{currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}
		</div>
		
		<div class="date-selectors">
			<select value={currentDate.getMonth()} on:change={handleMonthChange}>
				{#each months as month}
					<option value={month.value}>{month.name}</option>
				{/each}
			</select>
			
			<select value={currentDate.getFullYear()} on:change={handleYearChange}>
				{#each years as year}
					<option value={year}>{year}</option>
				{/each}
			</select>
		</div>
	</div>

	<div class="calendar">
		{#each day_names as day_name}
			<div class="day-name">{day_name}</div>
		{/each}
		
		{#each monthDays as day}
		<div class="day {day.getMonth() !== currentDate.getMonth() ? 'other-month' : ''}">
			{#if day}
			<div class="day-header">{day.getDate()}</div>
			{#each getEventsForDate(day) as event}
				<div class="event" on:click={() => handleEventClick(event)}>
					{event.title}
					<small>
						{new Date(event.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
					</small>
				</div>
			{/each}
			{/if}
		</div>
		{/each}
	</div>
</div>

{#if selectedEvent}
	<UpdateEvent 
		event={selectedEvent} 
		onClose={handleEventClose}
		onUpdated={handleEventUpdated}
		onDeleted={handleEventDeleted}
	/>
{/if}
