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
        font-weight: bold;
        margin-bottom: 5px;
    }
    
    .time-controls {
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    select {
        padding: 8px;
        border-radius: 4px;
        border: 1px solid #96616B;
        background-color: #FFEAD0;
        color: #96616B;
        font-size: 14px;
        appearance: none;
        background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2396616B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
        background-repeat: no-repeat;
        background-position: right 8px top 50%;
        background-size: 12px auto;
        cursor: pointer;
    }
    
    select:focus {
        outline: none;
        border-color: #7a4e56;
    }
    
    .separator {
        font-weight: bold;
        font-size: 18px;
        color: #96616B;
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