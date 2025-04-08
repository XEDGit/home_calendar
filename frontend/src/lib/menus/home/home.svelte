<script>
	import { onMount } from 'svelte';
	import { getEvents, getChores, getStats, getUsers, getRooms, signChore, delChore } from '$lib/requests';
	import Section from '$lib/header/Section.svelte';
	import ContentLayout from '$lib/containers/contentLayout.svelte';
	import Drag from '$lib/containers/drag.svelte';
	import UpdateEvent from '$lib/menus/calendar/updateEvent.svelte';
	import UpdateTask from '$lib/menus/chores/updateChore.svelte';
	
	// Data
	let events = null;
	let chores = null;
	let stats = null;
	let users = null;
	let users_by_id = null;
	let rooms = null;
	let rooms_by_id = null;
	let loading = true;
	
	// Statistics
	let totalStats = {
		choreCount: 0,
		eventCount: 0,
		overdueChores: 0,
		todayChores: 0,
		completedInRange: 0,
		userActivity: {},
		mostActiveUser: null,
		mostActiveRoom: null,
		roomActivity: {}
	};
	
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
	
	// Stats section
	let statsStartDate = new Date();
	let statsEndDate = new Date();
	let statsCustomRange = false;
	let statsDateRangeText = "Today";
	
	// UI state
	let selectedEvent = null;
	let selectedChoreId = null;
	
	// Set up initial dates
	eventsStartDate.setHours(0, 0, 0, 0);
	eventsEndDate.setHours(23, 59, 59, 999);
	choresStartDate.setHours(0, 0, 0, 0);
	choresEndDate.setHours(23, 59, 59, 999);
	statsStartDate.setHours(0, 0, 0, 0);
	statsEndDate.setHours(23, 59, 59, 999);
	
	// Events section date range
	function setEventsDateRange(days) {
		eventsCustomRange = false;
		eventsStartDate = new Date();
		eventsStartDate.setHours(0, 0, 0, 0);
		
		eventsEndDate = new Date();
		if (days > 0) {
			eventsEndDate.setDate(eventsEndDate.getDate() + days - 1);
		}
		eventsEndDate.setHours(23, 59, 59, 999);
		
		// Update the range text
		if (days === 1) {
			eventsDateRangeText = "Today";
		} else if (days === 2) {
			eventsDateRangeText = "Today & Tomorrow";
		} else if (days === 7) {
			eventsDateRangeText = "This Week";
		} else if (days === 30) {
			eventsDateRangeText = "This Month";
		} else {
			eventsDateRangeText = `Next ${days} Days`;
		}
		
		filterEvents();
	}
	
	// Chores section date range
	function setChoresDateRange(days) {
		choresCustomRange = false;
		choresStartDate = new Date();
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
			choresDateRangeText = "Today & Tomorrow";
		} else if (days === 7) {
			choresDateRangeText = "This Week";
		} else if (days === 30) {
			choresDateRangeText = "This Month";
		} else {
			choresDateRangeText = `Next ${days} Days`;
		}
		
		filterChores();
	}
	
	// Stats section date range
	function setStatsDateRange(days) {
		statsCustomRange = false;
		statsEndDate = new Date();
		statsEndDate.setHours(23, 59, 59, 999);
		
		statsStartDate = new Date();
		if (days > 0) {
			statsStartDate.setDate(statsStartDate.getDate() - days + 1);
		}
		statsStartDate.setHours(0, 0, 0, 0);
		
		// Update the range text
		if (days === 1) {
			statsDateRangeText = "Today";
		} else if (days === 2) {
			statsDateRangeText = "Yesterday & Today";
		} else if (days === 7) {
			statsDateRangeText = "Last Week";
		} else if (days === 30) {
			statsDateRangeText = "Last Month";
		} else {
			statsDateRangeText = `Last ${days} Days`;
		}
		
		calculateStats();
	}
	
	function setEventsCustomDateRange() {
		eventsCustomRange = true;
		eventsDateRangeText = "Custom Range";
		filterEvents();
	}
	
	function setChoresCustomDateRange() {
		choresCustomRange = true;
		choresDateRangeText = "Custom Range";
		filterChores();
	}
	
	function setStatsCustomDateRange() {
		statsCustomRange = true;
		statsDateRangeText = "Custom Range";
		calculateStats();
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
		
		filterEvents();
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
	
	function updateStatsCustomDateRange() {
		if (typeof statsStartDate === 'string') {
			statsStartDate = new Date(statsStartDate);
			statsStartDate.setHours(0, 0, 0, 0);
		}
		
		if (typeof statsEndDate === 'string') {
			statsEndDate = new Date(statsEndDate);
			statsEndDate.setHours(23, 59, 59, 999);
		}
		
		calculateStats();
	}
	
	let todayEvents = [];
	let upcomingChores = [];
	
	function filterEvents() {
		// Filter events between start and end date
		if (events) {
			todayEvents = events.filter(event => {
				const eventDate = new Date(event.when);
				return eventDate >= eventsStartDate && eventDate <= eventsEndDate;
			}).sort((a, b) => new Date(a.when) - new Date(b.when));
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
				if (dueDate >= choresStartDate && dueDate <= choresEndDate || dayNum <= 0) {
					chores[day].forEach(chore => {
						chore.dueDate = dueDate;
						allChores.push(chore);
					});
				}
			}
			upcomingChores = allChores.sort((a, b) => a.nextTime - b.nextTime);
			calculateStats();
		}
	}
	
	function calculateStats() {
		if (!events || !chores || !stats || !users_by_id || !rooms_by_id) return;
		
		// Reset statistics
		totalStats = {
			choreCount: 0,
			eventCount: 0,
			overdueChores: 0,
			todayChores: 0,
			completedInRange: 0,
			userActivity: {},
			mostActiveUser: null,
			mostActiveRoom: null,
			roomActivity: {}
		};
		
			// Count chores by status - regardless of date range filtering
		for (const day in chores) {
			const dayNum = parseInt(day);
			if (dayNum < 0) {
				totalStats.overdueChores += chores[day].length;
			} else if (dayNum === 0) {
				totalStats.todayChores += chores[day].length;
			}
		}

		// Count events in selected stats date range
		totalStats.eventCount = events.filter(event => {
			const eventDate = new Date(event.when);
			return eventDate >= statsStartDate && eventDate <= statsEndDate;
		}).length;
		
		// Count chores in selected stats date range
		totalStats.choreCount = 0;
		for (const day in chores) {
			const dayNum = parseInt(day);
			const today = new Date();
			const dueDate = new Date(today);
			dueDate.setDate(today.getDate() + dayNum);
			dueDate.setHours(0, 0, 0, 0);
			
			if (dueDate >= statsStartDate && dueDate <= statsEndDate) {
				totalStats.choreCount += chores[day].length;
			}
		}
		
		// User activity
		users.forEach(user => {
			totalStats.userActivity[user._id] = {
				name: user.name,
				count: 0,
				rooms: {}
			};
		});
		
		// Room activity
		rooms.forEach(room => {
			totalStats.roomActivity[room._id] = {
				name: room.name,
				count: 0
			};
		});
		
		// Process completed chores statistics based on selected date range
		console.log("Stats date range:", statsStartDate, statsEndDate);
		stats.forEach(stat => {
			const statDate = new Date(stat.date);
			if (statDate >= statsStartDate && statDate <= statsEndDate) {
				totalStats.completedInRange++;
				
				// Track user activity
				if (totalStats.userActivity[stat.who]) {
					totalStats.userActivity[stat.who].count++;
					
					// Track which rooms this user cleaned
					stat.rooms.forEach(roomId => {
						if (!totalStats.userActivity[stat.who].rooms[roomId]) {
							totalStats.userActivity[stat.who].rooms[roomId] = 0;
						}
						totalStats.userActivity[stat.who].rooms[roomId]++;
						
						// Track room activity
						if (totalStats.roomActivity[roomId]) {
							totalStats.roomActivity[roomId].count++;
						}
					});
				}
			}
		});
		
		// Find most active user
		let maxUserActivity = 0;
		for (const userId in totalStats.userActivity) {
			if (totalStats.userActivity[userId].count > maxUserActivity) {
				maxUserActivity = totalStats.userActivity[userId].count;
				totalStats.mostActiveUser = totalStats.userActivity[userId];
			}
		}
		
		// Find most cleaned room
		let maxRoomActivity = 0;
		for (const roomId in totalStats.roomActivity) {
			if (totalStats.roomActivity[roomId].count > maxRoomActivity) {
				maxRoomActivity = totalStats.roomActivity[roomId].count;
				totalStats.mostActiveRoom = totalStats.roomActivity[roomId];
			}
		}
	}
	
	// Sort chores by days
	async function parseChores() {
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
		
		chores = final;
		filterEvents();
		filterChores();
		calculateStats();
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
	
	async function loadData() {
		loading = true;
		
		// Load all the necessary data
		stats = await getStats();
		events = await getEvents();
		
		users = await getUsers();
		users_by_id = Object.fromEntries(users.map(u => [u._id, u]));
		
		rooms = await getRooms();
		rooms_by_id = Object.fromEntries(rooms.map(r => [r._id, r.name]));
		
		// Process and organize the data
		await parseChores();
		
		// Set default date range to today
		setEventsDateRange(7);
		setChoresDateRange(1);
		setStatsDateRange(30);
		
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
	
	.stat-section {
		margin-bottom: 20px;
	}
	
	.stats-container {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 15px;
		margin-top: 15px;
	}
	
	.stat-card {
		background-color: #FFEAD0;
		border: solid #96616B 2px;
		border-radius: 8px;
		padding: 15px;
		text-align: center;
		transition: transform 0.3s;
	}
	
	.stat-card:hover {
		transform: translateY(-5px);
	}
	
	.stat-value {
		font-size: 2rem;
		font-weight: bold;
		color: #96616B;
		margin: 10px 0;
	}
	
	.stat-label {
		font-size: 0.9rem;
		color: #555;
	}
	
	.achievements {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 10px;
	}
	
	.achievement-card {
		background-color: #FFEAD0;
		border: solid #96616B 2px;
		border-radius: 8px;
		padding: 15px;
		display: flex;
		align-items: center;
		gap: 15px;
	}
	
	.achievement-icon {
		background-color: #96616B;
		color: #FFEAD0;
		height: 40px;
		width: 40px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		font-weight: bold;
	}
	
	.achievement-content {
		flex: 1;
	}
	
	.achievement-title {
		font-weight: bold;
		color: #96616B;
		margin-bottom: 5px;
	}
	
	.achievement-description {
		font-size: 0.9rem;
		color: #555;
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
		color: #96616B;
		font-weight: bold;
	}
	
	.event-details {
		flex: 1;
		padding: 0 10px;
	}
	
	.event-title {
		font-weight: bold;
		color: #96616B;
	}
	
	.event-location {
		font-size: 0.9em;
		color: #666;
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
	
	@media (max-width: 768px) {
		.custom-date-input {
			flex-direction: column;
		}
		
		.stats-container {
			grid-template-columns: 1fr 1fr;
		}
	}
	
	@media (max-width: 480px) {
		.stats-container {
			grid-template-columns: 1fr;
		}
	}
</style>

<ContentLayout loading={loading}>
	<div class="dashboard">		
		<!-- Upcoming Events -->
		<div class="section">
			<Section title="Upcoming Events" subtitle={`${todayEvents.length} event${todayEvents.length !== 1 ? 's' : ''} in ${eventsDateRangeText.toLowerCase()}`} />
			
			<!-- Events Date Range Controls -->
			<div class="date-controls">
				<div class="range-buttons">
					<button class="range-button" class:active={eventsDateRangeText === "Today"} on:click={() => setEventsDateRange(1)}>
						Today
					</button>
					<button class="range-button" class:active={eventsDateRangeText === "Today & Tomorrow"} on:click={() => setEventsDateRange(2)}>
						+Tomorrow
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

		
		<!-- Stats Overview -->
		<div class="section stat-section">
			<Section title="Household Statistics" subtitle={`Data for ${statsDateRangeText.toLowerCase()}`} />
			
			<!-- Stats Date Range Controls -->
			<div class="date-controls">
				<div class="range-buttons">
					<button class="range-button" class:active={statsDateRangeText === "Today"} on:click={() => setStatsDateRange(1)}>
						Today
					</button>
					<button class="range-button" class:active={statsDateRangeText === "Yesterday & Today"} on:click={() => setStatsDateRange(2)}>
						+Yesterday
					</button>
					<button class="range-button" class:active={statsDateRangeText === "Last Week"} on:click={() => setStatsDateRange(7)}>
						Last Week
					</button>
					<button class="range-button" class:active={statsDateRangeText === "Last Month"} on:click={() => setStatsDateRange(30)}>
						Last Month
					</button>
					<button class="range-button" class:active={statsCustomRange} on:click={setStatsCustomDateRange}>
						Custom
					</button>
				</div>
				
				{#if statsCustomRange}
					<div class="custom-range">
						<div class="custom-date-input">
							<div>
								<label for="stats-start-date">Start Date:</label>
								<input 
									id="stats-start-date" 
									class="date-input" 
									type="date" 
									bind:value={statsStartDate} 
									on:change={updateStatsCustomDateRange}
								/>
							</div>
							<div>
								<label for="stats-end-date">End Date:</label>
								<input 
									id="stats-end-date" 
									class="date-input" 
									type="date" 
									bind:value={statsEndDate} 
									on:change={updateStatsCustomDateRange}
								/>
							</div>
						</div>
					</div>
				{/if}
			</div>
			
			<div class="stats-container">
				<div class="stat-card">
					<div class="stat-value">{totalStats.eventCount}</div>
					<div class="stat-label">Events</div>
				</div>
				
				<div class="stat-card">
					<div class="stat-value">{totalStats.choreCount}</div>
					<div class="stat-label">Chores in Period</div>
				</div>
				
				<div class="stat-card">
					<div class="stat-value">{totalStats.overdueChores}</div>
					<div class="stat-label">Overdue Chores</div>
				</div>
				
				<div class="stat-card">
					<div class="stat-value">{totalStats.todayChores}</div>
					<div class="stat-label">Due Today</div>
				</div>
				
				<div class="stat-card">
					<div class="stat-value">{totalStats.completedInRange}</div>
					<div class="stat-label">Completed in Period</div>
				</div>
				
				{#if totalStats.mostActiveUser}
					<div class="stat-card">
						<div class="stat-value">{totalStats.mostActiveUser?.name || '-'}</div>
						<div class="stat-label">Most Active User</div>
					</div>
				{/if}
			</div>
			
			<div class="achievements">
				{#if totalStats.mostActiveUser && totalStats.mostActiveUser.count > 0}
					<div class="achievement-card">
						<div class="achievement-icon">🏆</div>
						<div class="achievement-content">
							<div class="achievement-title">Most Active User</div>
							<div class="achievement-description">
								{totalStats.mostActiveUser.name} has completed {totalStats.mostActiveUser.count} chores in this period.
							</div>
						</div>
					</div>
				{/if}
				
				{#if totalStats.mostActiveRoom && totalStats.mostActiveRoom.count > 0}
					<div class="achievement-card">
						<div class="achievement-icon">🧹</div>
						<div class="achievement-content">
							<div class="achievement-title">Most Cleaned Room</div>
							<div class="achievement-description">
								{totalStats.mostActiveRoom.name} has been cleaned {totalStats.mostActiveRoom.count} times in this period.
							</div>
						</div>
					</div>
				{/if}
				
				{#if totalStats.overdueChores === 0 && totalStats.todayChores === 0}
					<div class="achievement-card">
						<div class="achievement-icon">🌟</div>
						<div class="achievement-content">
							<div class="achievement-title">All Caught Up!</div>
							<div class="achievement-description">
								No chores are currently overdue or due today. Great job keeping on top of things!
							</div>
						</div>
					</div>
				{/if}
				{#if totalStats.completedInRange > 0}
					<div class="achievement-card">
						<div class="achievement-icon">✅</div>
						<div class="achievement-content">
							<div class="achievement-title">Total chores</div>
							<div class="achievement-description">
								Your household has completed {totalStats.completedInRange} chore{totalStats.completedInRange !== 1 ? 's' : ''} in this period!
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Chores Section -->
		<div class="section">
			<Section 
				title="Upcoming Chores" 
				subtitle={`${upcomingChores.length} chore${upcomingChores.length !== 1 ? 's' : ''} in ${choresDateRangeText.toLowerCase()}${totalStats.overdueChores > 0 ? ` (${totalStats.overdueChores} overdue)` : ''}`} 
			/>
			
			<!-- Chores Date Range Controls -->
			<div class="date-controls">
				<div class="range-buttons">
					<button class="range-button" class:active={choresDateRangeText === "Today"} on:click={() => setChoresDateRange(1)}>
						Today
					</button>
					<button class="range-button" class:active={choresDateRangeText === "Today & Tomorrow"} on:click={() => setChoresDateRange(2)}>
						+Tomorrow
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
									<small style="font-size: 0.5em; margin: 0; margin-left: 10px; margin-top: 0.25em">Last signed by <small style="font-size: 1.3em;">{chore.last_sign}</small></small>
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