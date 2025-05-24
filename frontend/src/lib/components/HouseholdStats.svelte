<script>
    import Section from '$lib/header/Section.svelte';
    
    // Props
    export let stats = null;
    export let users = null;
    export let rooms = null;
    export let events = null;
    export let chores = null;
    export let users_by_id = null;
    export let rooms_by_id = null;
    
    // Date ranges for stats section
    let statsStartDate = new Date();
    let statsEndDate = new Date();
    let statsCustomRange = false;
    let statsDateRangeText = "Today";
    
    // Stats calculation
    let totalStats = {
        choreCount: 0,
        eventCount: 0,
        completedInRange: 0,
        userActivity: {},
        mostActiveUser: null,
        mostActiveRoom: null,
        roomActivity: {}
    };
    
    // Set up initial dates
    statsStartDate.setHours(0, 0, 0, 0);
    statsEndDate.setHours(23, 59, 59, 999);
    
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
    
    function setStatsCustomDateRange() {
        statsCustomRange = true;
        statsDateRangeText = "Custom Range";
        calculateStats();
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
    
    function calculateStats() {
        if (!events || !chores || !stats || !users_by_id || !rooms_by_id) return;
        
        // Reset statistics
        totalStats = {
            choreCount: 0,
            eventCount: 0,
            completedInRange: 0,
            userActivity: {},
            mostActiveUser: null,
            mostActiveRoom: null,
            roomActivity: {}
        };

        // Count events in selected stats date range
        totalStats.eventCount = events.filter(event => {
            const eventDate = new Date(event.when);
            return eventDate >= statsStartDate && eventDate <= statsEndDate;
        }).length;
        
        // Count chores in selected stats date range
        totalStats.choreCount = 0;
        for (const chore of chores) {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + chore.nextTime);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate >= statsStartDate && dueDate <= statsEndDate) {
                totalStats.choreCount += chore.rooms.length;
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
        console.log(totalStats)
    }
    
    // Initialize with default range when data is available
    $: if (stats && users && rooms && events && chores && users_by_id && rooms_by_id) {
        setStatsDateRange(30); // Default to last 30 days
    }
</script>

<style>
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
        font-size: 1.6rem;
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

<div class="section stat-section">
    <Section title="Household Statistics" subtitle={`Data for ${statsDateRangeText.toLowerCase()}`} />
    
    <!-- Stats Date Range Controls -->
    <div class="date-controls">
        <div class="range-buttons">
            <button class="range-button" class:active={statsDateRangeText === "Today"} on:click={() => setStatsDateRange(1)}>
                Today
            </button>
            <button class="range-button" class:active={statsDateRangeText === "Yesterday & Today"} on:click={() => setStatsDateRange(2)}>
                Yesterday
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