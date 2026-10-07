<script>
    import { createEventDispatcher } from 'svelte';
    const dispatcher = createEventDispatcher();
    // Props
    export let value = '';  // Format: "HH:MM" in 24-hour format
    export let label = "Time";
    export let required = false;
    export let id = "";
    
    // Internal state
    let hours = 0;
    let minutes = 0;
    
    // Initialize from value if provided
    $: {
        if (value) {
            try {
                const [h, m] = value.split(':');
                hours = parseInt(h, 10);
                minutes = parseInt(m, 10);
            } catch (e) {
                console.error('Invalid time format:', value);
            }
        }
    }

    function updateValue() {
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        value = formattedTime;

        dispatcher('change', { time: formattedTime });
    }
    
    // Generate arrays for hours (0-23) and minutes (0-59)
    const hoursArray = Array.from({ length: 24 }, (_, i) => i);
    const minutesArray = Array.from({ length: 4 }, (_, i) => i * 15);
</script>

<style>
    .time-picker {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    
    .time-label {
        font-weight: var(--weight-bold);
        margin-bottom: 5px;
    }
    
    .time-controls {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    select {
        padding: 8px;
        border-radius: var(--radius-md);
        border: var(--bw) solid var(--primary);
        background-color: var(--paper);
        color: var(--primary);
        appearance: none;
        /* Down-arrow drawn in the theme colour (an SVG data URI can't follow the theme) */
        padding-right: 26px;
        background-image:
            linear-gradient(45deg, transparent 50%, var(--primary) 50%),
            linear-gradient(135deg, var(--primary) 50%, transparent 50%);
        background-repeat: no-repeat;
        background-position:
            right 14px top 50%,
            right 9px top 50%;
        background-size: 5px 5px, 5px 5px;
        cursor: pointer;
    }
    
    select:focus {
        border-color: var(--primary-deep);
    }
    
    .separator {
        font-weight: var(--weight-bold);
        font-size: var(--text-md);
        color: var(--primary);
    }
    
    .hour-select, .minute-select {
        width: 70px;
    }
    
    /* For small screens */
    @media (max-width: 480px) {
        .time-controls {
            flex-wrap: wrap;
        }
    }
</style>

<div class="time-picker" id={id}>
    <label for={id} class="time-label">{label} {required ? '*' : ''}</label>
    
    <div class="time-controls">
        <select 
            id={`${id}-hour`}
            class="hour-select"
            bind:value={hours}
            on:change={updateValue}
        >
            {#each hoursArray as hour}
                <option value={hour}>{hour.toString().padStart(2, '0')}</option>
            {/each}
        </select>
        
        <span class="separator">:</span>

        <select
            id={`${id}-minute`}
            class="minute-select"
            bind:value={minutes} 
            on:change={updateValue}
        >
            {#each minutesArray as minute}
                <option value={minute}>{minute.toString().padStart(2, '0')}</option>
            {/each}
        </select>
    </div>
</div>