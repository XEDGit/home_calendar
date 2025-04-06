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
	
	// Date range
	let startDate = new Date();
	let endDate = new Date();
	let customRange = false;
	let dateRangeText = "Today";
	
	// UI state
	let selectedEvent = null;
	let selectedChoreId = null;
	
	// Set up initial dates
	startDate.setHours(0, 0, 0, 0);
	endDate.setHours(23, 59, 59, 999);
	
	function setDateRange(days) {
		customRange = false;
		startDate = new Date();
		startDate.setHours(0, 0, 0, 0);
		
		endDate = new Date();
		if (days > 0) {
			endDate.setDate(endDate.getDate() + days - 1);
		}
		endDate.setHours(23, 59, 59, 999);
		
		// Update the range text
		if (days === 1) {
			dateRangeText = "Today";
		} else if (days === 2) {
			dateRangeText = "Today & Tomorrow";
		} else if (days === 7) {
			dateRangeText = "This Week";
		} else if (days === 30) {
			dateRangeText = "This Month";
		} else {
			dateRangeText = `Next ${days} Days`;
		}
		
		filterData();
	}
	
	function setCustomDateRange() {
		customRange = true;
		dateRangeText = "Custom Range";
		filterData();
	}
	
	// Convert string dates to Date objects for the custom date range
	function updateCustomDateRange() {
		if (typeof startDate === 'string') {
			startDate = new Date(startDate);
			startDate.setHours(0, 0, 0, 0);
		}
		
		if (typeof endDate === 'string') {
			endDate = new Date(endDate);
			endDate.setHours(23, 59, 59, 999);
		}
		
		filterData();
	}
	
	let todayEvents = [];
	let upcomingChores = [];
	
	function filterData() {
		// Filter events between start and end date
		if (events) {
			todayEvents = events.filter(event => {
				const eventDate = new Date(event.when);
				return eventDate >= startDate && eventDate <= endDate;
			}).sort((a, b) => new Date(a.when) - new Date(b.when));
		}
		
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
				if (dueDate >= startDate && dueDate <= endDate || dayNum <= 0) {
					chores[day].forEach(chore => {
						chore.dueDate = dueDate;
						allChores.push(chore);
					});
				}
			}
			upcomingChores = allChores.sort((a, b) => a.nextTime - b.nextTime);
		}
		
		calculateStats();
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
		
		// Events in date range (already filtered in todayEvents)
		totalStats.eventCount = todayEvents.length;
		
		// Count chores by status - filtered based on selected date range
		totalStats.choreCount = upcomingChores.length;
		
		// Still count overall overdue and today's chores for reference
		for (const day in chores) {
			const dayNum = parseInt(day);
			if (dayNum < 0) {
				totalStats.overdueChores += chores[day].length;
			} else if (dayNum === 0) {
				totalStats.todayChores += chores[day].length;
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
		stats.forEach(stat => {
			const statDate = new Date(stat.date);
			if (statDate >= startDate && statDate <= endDate) {
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
		filterData();
	}
	
	function getDateLabel(dayNumber) {
		if (dayNumber > 42) {
			return 'Far future';
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
		filterData();
	}
	
	function handleEventDeleted(eventId) {
		events = events.filter(e => e._id !== eventId);
		filterData();
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
		setDateRange(1);
		
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
        <!-- Date Range Controls -->
		<div class="date-controls">
			<Section title="Select time period" subtitle={dateRangeText} />
			
			<div class="range-buttons">
				<button class="range-button" class:active={dateRangeText === "Today"} on:click={() => setDateRange(1)}>
					Today
				</button>
				<button class="range-button" class:active={dateRangeText === "Today & Tomorrow"} on:click={() => setDateRange(2)}>
					+Tomorrow
				</button>
				<button class="range-button" class:active={dateRangeText === "This Week"} on:click={() => setDateRange(7)}>
					This Week
				</button>
				<button class="range-button" class:active={dateRangeText === "This Month"} on:click={() => setDateRange(30)}>
					This Month
				</button>
				<button class="range-button" class:active={customRange} on:click={setCustomDateRange}>
					Custom
				</button>
			</div>
			
			{#if customRange}
				<div class="custom-range">
					<div class="custom-date-input">
						<div>
							<label for="start-date">Start Date:</label>
							<input 
								id="start-date" 
								class="date-input" 
								type="date" 
								bind:value={startDate} 
								on:change={updateCustomDateRange}
							/>
						</div>
						<div>
							<label for="end-date">End Date:</label>
							<input 
								id="end-date" 
								class="date-input" 
								type="date" 
								bind:value={endDate} 
								on:change={updateCustomDateRange}
							/>
						</div>
					</div>
				</div>
			{/if}
		</div>
		
		<!-- Upcoming Events -->
		<div class="section">
			<Section title="Upcoming Events" subtitle={`${todayEvents.length} event${todayEvents.length !== 1 ? 's' : ''} in ${dateRangeText.toLowerCase()}`} />
			
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
		
		<!-- Chores Section -->
		<div class="section">
			<Section 
				title="Upcoming Chores" 
				subtitle={`${upcomingChores.length} chore${upcomingChores.length !== 1 ? 's' : ''} in ${dateRangeText.toLowerCase()}${totalStats.overdueChores > 0 ? ` (${totalStats.overdueChores} overdue)` : ''}`} 
			/>
			
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
    <!-- Stats Overview -->
		<div class="section stat-section">
			<Section title="Household Statistics" subtitle={`Data for ${dateRangeText.toLowerCase()}`} />
			
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