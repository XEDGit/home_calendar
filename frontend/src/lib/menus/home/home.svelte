<script>
	import { onMount } from 'svelte';
	import { getEvents, getChores, getUsers, getRooms, signChore, delChore, getTodos, getTags, updateTodo, deleteTodo } from '$lib/requests';
	import Section from '$lib/header/Section.svelte';
	import ContentLayout from '$lib/containers/contentLayout.svelte';
	import Drag from '$lib/containers/drag.svelte';
	import UpdateEvent from '$lib/menus/calendar/updateEvent.svelte';
	import UpdateTask from '$lib/menus/chores/updateChore.svelte';
	import Card from '$lib/buttons/card.svelte'; // Import Card component
	import UpdateTodo from '$lib/menus/todo/updateTodo.svelte'; // Import UpdateTodo component

	// Data
	let events = null;
	let chores = null;
	let users = null;
	let users_by_id = null;
	let rooms = null;
	let rooms_by_id = null;
	let todos = []; // Add todos state
	let tags = []; // Add tags state
	let activeTags = []; // Add activeTags state
	let loading = true;
	
	// Date ranges for each section
	// Events section
	let eventsStartDate = new Date();
	let eventsEndDate = new Date();
	let eventsCustomRange = false;
	let eventsDateRangeText = "Today";
	
	// Chores section
	let choresStartDate = new Date();
	let choresEndDate = new Date();
	let choresCustomRange = false;
	let choresDateRangeText = "Today";
	
	// UI state
	let selectedEvent = null;
	let selectedChoreId = null;
	let selectedTodo = null; // Add selectedTodo state
	
	// Set up initial dates
	eventsStartDate.setHours(0, 0, 0, 0);
	eventsEndDate.setHours(23, 59, 59, 999);
	choresStartDate.setHours(0, 0, 0, 0);
	choresEndDate.setHours(23, 59, 59, 999);
	
	// Events section date range
	function setEventsDateRange(days) {
		eventsCustomRange = false;
		eventsStartDate = new Date();
		eventsStartDate.setHours(0, 0, 0, 0);
		
		eventsEndDate = new Date();
		if (days > 0) {
			eventsEndDate.setDate(eventsEndDate.getDate() + days - 1);
		}
		if (days == 2) {
			eventsStartDate.setDate(eventsStartDate.getDate() + 1);
		}
		eventsEndDate.setHours(23, 59, 59, 999);

		// Update the range text
		if (days === 1) {
			eventsDateRangeText = "Today";
		} else if (days === 2) {
			eventsDateRangeText = "Tomorrow";
		} else if (days === 7) {
			eventsDateRangeText = "This Week";
		} else if (days === 30) {
			eventsDateRangeText = "This Month";
		} else {
			eventsDateRangeText = `Next ${days} Days`;
		}
		
		// Reload events with the new date range
		loadEventsWithDateRange();
	}
	
	// Chores section date range
	function setChoresDateRange(days) {
		choresCustomRange = false;
		choresStartDate = new Date();
		if (days == 2) {
			choresStartDate.setDate(choresStartDate.getDate() + 1);
		}
		choresStartDate.setHours(0, 0, 0, 0);

		choresEndDate = new Date();
		if (days > 0) {
			choresEndDate.setDate(choresEndDate.getDate() + days - 1);
		}
		choresEndDate.setHours(23, 59, 59, 999);

		// Update the range text
		if (days === 1) {
			choresDateRangeText = "Today";
		} else if (days === 2) {
			choresDateRangeText = "Tomorrow";
		} else if (days === 7) {
			choresDateRangeText = "This Week";
		} else if (days === 30) {
			choresDateRangeText = "This Month";
		} else {
			choresDateRangeText = `Next ${days} Days`;
		}
		
		filterChores();
	}

	function setEventsCustomDateRange() {
		eventsCustomRange = true;
		eventsDateRangeText = "Custom Range";
		// Don't reload events yet, wait for user to select dates
	}
	
	function setChoresCustomDateRange() {
		choresCustomRange = true;
		choresDateRangeText = "Custom Range";
		filterChores();
	}
	
	// Convert string dates to Date objects for the custom date range
	function updateEventsCustomDateRange() {
		if (typeof eventsStartDate === 'string') {
			eventsStartDate = new Date(eventsStartDate);
			eventsStartDate.setHours(0, 0, 0, 0);
		}
		
		if (typeof eventsEndDate === 'string') {
			eventsEndDate = new Date(eventsEndDate);
			eventsEndDate.setHours(23, 59, 59, 999);
		}
		
		// Reload events with the new date range
		loadEventsWithDateRange();
	}
	
	function updateChoresCustomDateRange() {
		if (typeof choresStartDate === 'string') {
			choresStartDate = new Date(choresStartDate);
			choresStartDate.setHours(0, 0, 0, 0);
		}
		
		if (typeof choresEndDate === 'string') {
			choresEndDate = new Date(choresEndDate);
			choresEndDate.setHours(23, 59, 59, 999);
		}
		
		filterChores();
	}
	
	let todayEvents = [];
	let upcomingChores = [];
	
	function filterEvents() {
			// The events are already pre-expanded by the backend with date range filtering
			// Just need to sort them chronologically
			if (events) {
					todayEvents = events.sort((a, b) => new Date(a.when) - new Date(b.when));
			}
	}
	
	function filterChores() {
		// Filter chores for the date range
		if (chores) {
			// Flatten the chores object into an array
			const allChores = [];
			for (const day in chores) {
				// For date range filtering, we need to predict when a chore will be due
				const dayNum = parseInt(day);
				const today = new Date();
				const dueDate = new Date(today);
				dueDate.setDate(today.getDate() + dayNum);
				dueDate.setHours(0, 0, 0, 0);
				
				// Include the chore if it falls within the selected date range
				// or if it's overdue/due today (always show these)
				if (dueDate >= choresStartDate && dueDate <= choresEndDate) {
					chores[day].forEach(chore => {
						chore.dueDate = dueDate;
						allChores.push(chore);
					});
				}
			}
			upcomingChores = allChores.sort((a, b) => a.nextTime - b.nextTime);
		}
	}

	// Sort chores by days
	async function parseChores() {
		let res = await getChores()
		let perDay = res.reduce((acc, chore, index) => {
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
		
		chores = final;
		filterEvents();
		filterChores();
	}
	
	// Function to load events with the current date range
	async function loadEventsWithDateRange() {
		// Show loading state
		loading = true;
		
		// Get current date range for events
		const start = eventsStartDate.toISOString();
		const end = eventsEndDate.toISOString();
		
		// Load events with date range to efficiently handle repeating events
		events = await getEvents(start, end);
		
		// Filter and sort events
		filterEvents();
		
		// Hide loading state
		loading = false;
	}

	// Handlers for event details
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
		filterEvents();
	}
	
	function handleEventDeleted(eventId) {
		events = events.filter(e => e._id !== eventId);
		filterEvents();
	}
	
	// Handlers for chore details
	function handleChoreClick(choreId) {
		selectedChoreId = choreId;
	}
	
	function resetChoreSelection() {
		selectedChoreId = null;
	}
	
	async function afterSignChore(data) {
		await signChore(data);
		await loadData();
	}
	
	async function afterDelChore(id) {
		await delChore({"id": id});
		await loadData();
	}

	// Todo section functions
	const handleTagClick = (idx) => {
		activeTags[idx] = !activeTags[idx];
		activeTags = activeTags; // Trigger reactivity
	}

	const filterTodos = (todosToFilter) => {
			// Filter for high priority first
			let highestPriority = todosToFilter;
			for (let targetPriority = 3; targetPriority >= 0; targetPriority--) {
				highestPriority = todosToFilter.filter(todo => todo.priority == targetPriority);
				if (highestPriority.length > 0) {
					break;
				}
			}
	
			// Check if any tag is active. If not, return all high priority todos.
			const anyTagActive = activeTags.some(tag => tag);
			if (!anyTagActive) {
				return highestPriority;
			}
	
			// Get the status of special tags
			const personalActive = activeTags[0];
			const sharedActive = activeTags[1];
	
			// Get the list of active regular tags (tags excluding 'personal' and 'shared')
			const activeRegularTags = tags.slice(2).filter((_, i) => activeTags[i + 2]);
	
			// Filter high priority todos based on active tags
			return highestPriority.filter(todo => {
				let matchesRegularTag = true;
				// Check if the todo matches any active regular tag
				if (activeRegularTags.length > 0) {
					matchesRegularTag = activeRegularTags.includes(todo.tag);
				}
	
				// Check if the todo matches the 'personal' criteria (if active)
				const matchesPersonal = personalActive && !todo.shared;
	
				// Check if the todo matches the 'shared' criteria (if active)
				const matchesShared = sharedActive && todo.shared;
	
				// Determine if the todo matches based on active special tags
				let matchesSpecialTag = true;
				if (personalActive || sharedActive) {
					matchesSpecialTag = matchesPersonal || matchesShared;
				}
	
				// The todo should be included if it matches active regular tags AND active special tags
				// (It's already confirmed to be high priority)
				return matchesRegularTag && matchesSpecialTag;
			});
		};

	function handleTodoClick(todo) {
		selectedTodo = todo;
	}

	function resetTodoSelection() {
		selectedTodo = null;
	}

	async function handleTodoUpdate(updatedTodoData) {
		try {
			// The data from UpdateTodo might not have the _id, ensure it's included
			const payload = { ...updatedTodoData, _id: selectedTodo._id };
			await updateTodo(payload);
			// Reload data to reflect changes
			await loadData();
			resetTodoSelection();
		} catch (error) {
			console.error('Error updating todo:', error);
		}
	}

	async function handleTodoDelete(todoId) {
		try {
			await deleteTodo({ id: todoId });
			// Reload data to reflect changes
			await loadData();
			resetTodoSelection();
		} catch (error) {
			console.error('Error deleting todo:', error);
		}
	}
	
	async function loadData() {
		loading = true;
		
			// Get current date range for events
			const start = eventsStartDate.toISOString();
			const end = eventsEndDate.toISOString();
			
			// Load events with date range to efficiently handle repeating events
			events = await getEvents(start, end);
			
			users = await getUsers();
			users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
			
			rooms = await getRooms();
			rooms_by_id = Object.fromEntries(rooms.map(r => [r._id, r.name]));
	
			// Load todos and tags
			todos = await getTodos();
			tags = await getTags();
			tags.unshift('shared');
			tags.unshift('personal');
			activeTags = tags.map(() => false); // Initialize activeTags
			
			// Process and organize the data
			await parseChores();
			
			// Filter events - no need to recalculate repeats as they're already expanded by the backend
			filterEvents();
			filterChores();
	
			loading = false;
		}
	
	onMount(async () => {
		await loadData();
	});
</script>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	
	.section {
		margin-bottom: 20px;
	}
	
	.date-controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-bottom: 20px;
	}
	
	.range-buttons {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin-top: 10px;
		flex-wrap: wrap;
	}
	
	.range-button {
		background-color: #FFEAD0;
		border: solid #96616B 2px;
		border-radius: 5px;
		color: #96616B;
		padding: 5px 10px;
		cursor: pointer;
		font-weight: bold;
	}
	
	.range-button:hover, .range-button.active {
		background-color: #96616B;
		color: #FFEAD0;
	}
	
	.custom-range {
		display: flex;
		flex-direction: column;
		gap: 10px;
		align-items: center;
	}
	
	.event-list, .chore-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	
	.event-item {
		background-color: #FFEAD0;
		border: solid #96616B 2px;
		color: #96616B;
		border-radius: 5px;
		padding: 10px;
		display: flex;
		justify-content: space-between;
		cursor: pointer;
		transition: background-color 0.3s;
	}
	
	.event-item:hover {
		background-color: #f8e0c0;
	}
	
	.event-time {
		font-weight: bold;
	}
	
	.event-details {
		flex: 1;
		padding: 0 10px;
	}
	
	.event-title {
		font-weight: bold;
	}
	
	.event-location {
		font-size: 0.9em;
	}
	
	.chore-container {
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
	
	.chore-name {
		float: left;
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
	
	.custom-date-input {
		display: flex;
		gap: 10px;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
	}
	
	.date-input {
		padding: 8px;
		border: 1px solid #96616B;
		border-radius: 4px;
		color: #96616B;
	}
	
	.empty-message {
		text-align: center;
		color: #96616B;
		font-style: italic;
		padding: 20px;
	}

	/* Styles copied/adapted from todo.svelte */
	.todo-container {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: flex-start; /* Align items to the start */
		flex-direction: row;
		gap: 1em;
		padding: 0 10px; /* Add some padding */
	}

	@media (max-width: 670px) {
		.todo-container {
			justify-content: center; /* Center items on smaller screens */
		}
	}

	.filter {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center; /* Center filter buttons */
		flex-direction: row;
		gap: 1em;
		color: #96616B;
		margin-bottom: 20px;
	}

	.filter button { /* More specific selector */
		background-color: #FFEAD0;
		color: #96616B;
		border: solid 2px #96616B;
		border-radius: 5px;
		padding: 5px 10px;
		cursor: pointer;
		font-weight: bold;
	}

	.filter button:hover { /* More specific selector */
		background-color: #FFEAD0;
		color: #96616B;
	}

	.filter button::before { /* More specific selector */
		content: '# ';
	}

	.filter button.active, .filter button.active:hover { /* More specific selector */
		background-color: #96616B;
		color: #FFEAD0;
	}
	
	@media (max-width: 768px) {
		.custom-date-input {
			flex-direction: column;
		}
	}
</style>

<ContentLayout loading={loading}>
	<div class="dashboard">		
		<!-- Upcoming Events -->
		<div class="section">
			<Section title={eventsDateRangeText + "'s Events"} subtitle={`${todayEvents.length} event${todayEvents.length !== 1 ? 's' : ''} in ${eventsDateRangeText.toLowerCase()}`} />
			
			<!-- Events Date Range Controls -->
			<div class="date-controls">
				<div class="range-buttons">
					<button class="range-button" class:active={eventsDateRangeText === "Today"} on:click={() => setEventsDateRange(1)}>
						Today
					</button>
					<button class="range-button" class:active={eventsDateRangeText === "Tomorrow"} on:click={() => setEventsDateRange(2)}>
						Tomorrow
					</button>
					<button class="range-button" class:active={eventsDateRangeText === "This Week"} on:click={() => setEventsDateRange(7)}>
						This Week
					</button>
					<button class="range-button" class:active={eventsDateRangeText === "This Month"} on:click={() => setEventsDateRange(30)}>
						This Month
					</button>
					<button class="range-button" class:active={eventsCustomRange} on:click={setEventsCustomDateRange}>
						Custom
					</button>
				</div>
				
				{#if eventsCustomRange}
					<div class="custom-range">
						<div class="custom-date-input">
							<div>
								<label for="events-start-date">Start Date:</label>
								<input 
									id="events-start-date" 
									class="date-input" 
									type="date" 
									bind:value={eventsStartDate} 
									on:change={updateEventsCustomDateRange}
								/>
							</div>
							<div>
								<label for="events-end-date">End Date:</label>
								<input 
									id="events-end-date" 
									class="date-input" 
									type="date" 
									bind:value={eventsEndDate} 
									on:change={updateEventsCustomDateRange}
								/>
							</div>
						</div>
					</div>
				{/if}
			</div>
			
			{#if todayEvents.length > 0}
				<div class="event-list">
					{#each todayEvents as event}
						<div class="event-item" on:click={() => handleEventClick(event)}>
							<div class="event-time">
								{new Date(event.when).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
							</div>
							<div class="event-details">
								<div class="event-title">{event.title}</div>
								{#if event.location}
									<div class="event-location">{event.location}</div>
								{/if}
							</div>
							<div class="event-date">
								{new Date(event.when).toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'})}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty-message">
					<p>No events scheduled for this time period.</p>
				</div>
			{/if}
		</div>

		<!-- Upcoming Todos -->
		<div class="section">
			<Section title="Important Todos" />

			<!-- Tag Filters -->
			<div class='filter'>
				<span style='font-weight: bold'>Tags:</span>
				{#each tags as tag, idx}
					<button class='tag {activeTags[idx]? 'active' : ''}' on:click={() => handleTagClick(idx)}>
						{tag}
					</button>
				{/each}
			</div>

			<!-- Todo List -->
			{#if filterTodos(todos).length > 0}
				<div class="todo-container">
					{#each filterTodos(todos) as todo}
						<Card
							title={todo.title}
							shortTitle={todo.shortTitle}
							subtitle={todo.subtitle || ''}
							content={todo.description || ''}
							tag={todo.tag || ''}
							deadline={todo.deadline || ''}
							priority={todo.priority || ''}
							shared={todo.shared || ''}
							done={todo.done || ''}
							func={() => {handleTodoClick(todo)}}
							updateDone={async () => {
								const updatedDoneStatus = !todo.done;
								// Optimistically update UI
								todo.done = updatedDoneStatus;
								todos = todos; // Trigger reactivity
								try {
									await updateTodo({ _id: todo._id, done: updatedDoneStatus });
									// Optionally reload data if needed, or rely on optimistic update
									// await loadData(); 
								} catch (error) {
									console.error('Error updating todo done status:', error);
									// Revert UI change on error
									todo.done = !updatedDoneStatus;
									todos = todos; 
								}
							}}
						/>
					{/each}
				</div>
			{:else}
				<div class="empty-message">
					<p>No todos match the selected filters.</p>
				</div>
			{/if}
		</div>
		
		<!-- Chores Section -->
		<div class="section">
			<Section 
				title={choresDateRangeText +"'s Chores"} 
			/>
			
			<!-- Chores Date Range Controls -->
			<div class="date-controls">
				<div class="range-buttons">
					<button class="range-button" class:active={choresDateRangeText === "Today"} on:click={() => setChoresDateRange(1)}>
						Today
					</button>
					<button class="range-button" class:active={choresDateRangeText === "Tomorrow"} on:click={() => setChoresDateRange(2)}>
						Tomorrow
					</button>
					<button class="range-button" class:active={choresDateRangeText === "This Week"} on:click={() => setChoresDateRange(7)}>
						This Week
					</button>
					<button class="range-button" class:active={choresDateRangeText === "This Month"} on:click={() => setChoresDateRange(30)}>
						This Month
					</button>
					<button class="range-button" class:active={choresCustomRange} on:click={setChoresCustomDateRange}>
						Custom
					</button>
				</div>
				
				{#if choresCustomRange}
					<div class="custom-range">
						<div class="custom-date-input">
							<div>
								<label for="chores-start-date">Start Date:</label>
								<input 
									id="chores-start-date" 
									class="date-input" 
									type="date" 
									bind:value={choresStartDate} 
									on:change={updateChoresCustomDateRange}
								/>
							</div>
							<div>
								<label for="chores-end-date">End Date:</label>
								<input 
									id="chores-end-date" 
									class="date-input" 
									type="date" 
									bind:value={choresEndDate} 
									on:change={updateChoresCustomDateRange}
								/>
							</div>
						</div>
					</div>
				{/if}
			</div>
			
			{#if upcomingChores.length > 0}
				<div class="chore-list">
					{#each upcomingChores as chore}
						<div class="chore-container" style='z-index: {selectedChoreId === chore._id ? "1" : "0"};' on:click={() => {if (selectedChoreId !== chore._id) handleChoreClick(chore._id);}}>
							<Drag>
								<div class="chore-name">
									<p>{chore.name}</p>
									<div class="fade"></div>
								</div>
								<div class="info-right">
									<p class="room-text">{chore.rooms.length} room{chore.rooms.length !== 1 ? 's' : ''}</p>
									<hr class="urgency-indicator" style="background-color: {chore.nextTime < -2 ? '#DB324D' : chore.nextTime <= -1 ? 'orange' : chore.nextTime == 0 ? 'green' : 'gray'}" />
								</div>
							</Drag>
							{#if selectedChoreId === chore._id}
								<UpdateTask 
									chore={chore} 
									users={users}
									onSubmit={(updateChore) => {afterSignChore(updateChore); resetChoreSelection();}} 
									reset={resetChoreSelection} 
									delFunc={afterDelChore} 
								/>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="empty-message">
					<p>No chores scheduled for this time period.</p>
				</div>
			{/if}
		</div>

	</div>
</ContentLayout>

<!-- Event Detail Modal -->
{#if selectedEvent}
	<UpdateEvent 
		event={selectedEvent} 
		onClose={handleEventClose}
		onUpdated={handleEventUpdated}
		onDeleted={handleEventDeleted}
	/>
{/if}

<!-- Todo Detail Modal -->
{#if selectedTodo}
	<UpdateTodo 
		todo={selectedTodo} 
		onSubmit={handleTodoUpdate} 
		reset={resetTodoSelection} 
		delFunc={() => handleTodoDelete(selectedTodo._id)} 
	/>
{/if}