<script>
    import Section from '#lib/header/Section.svelte';
    
    // Props
    export let stats = null;
    export let users = null;
    export let rooms = null;
    export let events = null;
    export let chores = null;
    export let users_by_id = null;
    export let rooms_by_id = null;
    // Told the picked range, so the graph below can cover the same days
    export let onRangeChange = () => {};
    
    // Date ranges for stats section
    let statsStartDate = new Date();
    let statsEndDate = new Date();
    let statsCustomRange = false;
    let statsDateRangeText = "Today";
    // The custom date inputs hold YYYY-MM-DD strings
    let customStart = '';
    let customEnd = '';
    
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
        
        rangeChanged();
    }
    
    function toInputDate(date) {
        const pad = n => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
    
    // Local midnight; new Date('YYYY-MM-DD') would be UTC midnight
    function fromInputDate(value) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }
    
    function setStatsCustomDateRange() {
        statsCustomRange = true;
        statsDateRangeText = "Custom Range";
        customStart = toInputDate(statsStartDate);
        customEnd = toInputDate(statsEndDate);
        rangeChanged();
    }
    
    function updateStatsCustomDateRange() {
        if (!customStart || !customEnd) return;
        statsStartDate = fromInputDate(customStart);
        statsEndDate = fromInputDate(customEnd);
        statsEndDate.setHours(23, 59, 59, 999);
        rangeChanged();
    }
    
    function rangeChanged() {
        calculateStats();
        onRangeChange(statsStartDate, statsEndDate);
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
    
    // Default range once the data first arrives; refreshes (a deleted stat,
    // coming back to the tab) keep the range that was picked
    let initialized = false;
    function refresh() {
        if (initialized) {
            calculateStats();
            return;
        }
        initialized = true;
        setStatsDateRange(30); // Default to last 30 days
    }

    $: if (stats && users && rooms && events && chores && users_by_id && rooms_by_id) {
        refresh();
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
        background-color: var(--paper);
        border: var(--bw) solid var(--primary);
        border-radius: var(--radius-lg);
        padding: var(--space-md);
        text-align: center;
        transition: transform var(--dur-base) var(--ease-out);
    }
    
    @media (hover: hover) {
        .stat-card:hover {
            transform: translateY(-5px);
        }
    }
    
    .stat-value {
        font-size: var(--text-xl);
        font-weight: var(--weight-bold);
        color: var(--primary);
        margin: 10px 0;
    }
    
    .stat-label {
        font-size: var(--text-sm);
        color: var(--primary);
    }
    
    .achievements {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 10px;
    }
    
    .achievement-card {
        background-color: var(--paper);
        border: var(--bw) solid var(--primary);
        border-radius: var(--radius-lg);
        padding: var(--space-md);
        display: flex;
        align-items: center;
        gap: 15px;
    }
    
    .achievement-icon {
        background-color: var(--primary);
        color: var(--paper);
        height: 40px;
        width: 40px;
        border-radius: var(--radius-circle);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--text-md);
        font-weight: var(--weight-bold);
    }
    
    .achievement-content {
        flex: 1;
    }
    
    .achievement-title {
        font-weight: var(--weight-bold);
        color: var(--primary);
        margin-bottom: 5px;
    }
    
    .achievement-description {
        font-size: var(--text-sm);
        color: var(--primary);
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
        background-color: var(--paper);
        border: var(--bw) solid var(--primary);
        border-radius: var(--radius-pill);
        color: var(--primary);
        padding: var(--chip-pad-y) var(--chip-pad-x);
        cursor: pointer;
        font-weight: var(--weight-bold);
        transition: var(--swap);
    }
    
    .range-button.active {
        background-color: var(--primary);
        color: var(--paper);
    }

    @media (hover: hover) {
        .range-button:hover {
            background-color: var(--primary);
            color: var(--paper);
        }
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
        border: var(--bw) solid var(--primary);
        border-radius: var(--radius-md);
        color: var(--primary);
        background-color: var(--paper);
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
                            bind:value={customStart} 
                            on:change={updateStatsCustomDateRange}
                        />
                    </div>
                    <div>
                        <label for="stats-end-date">End Date:</label>
                        <input 
                            id="stats-end-date" 
                            class="date-input" 
                            type="date" 
                            bind:value={customEnd} 
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