<script>
    import TimePicker from './TimePicker.svelte';
    
    export let value = '';  // ISO format: "YYYY-MM-DDTHH:MM:SS"
    export let required = false;
    export let id = "datetime-picker";
    
    // Split the value into date and time components
    let dateValue = '';
    let timeValue = '';
    
    // Parse the ISO date if provided
    $: {
        if (value) {
            try {
                const date = new Date(value);
                if (!isNaN(date)) {
                    dateValue = date.toISOString().split('T')[0];
                    
                    // Format time as HH:MM
                    const hours = date.getHours().toString().padStart(2, '0');
                    const normalizedMinutesValue = (Math.round(date.getMinutes() / 15) * 15) % 60; // Normalize to 0, 15, 30, 45
                    const minutes = normalizedMinutesValue.toString().padStart(2, '0');
                    timeValue = `${hours}:${minutes}`;
                }
            } catch (e) {
                console.error('Invalid datetime format:', value);
            }
        } else {
            // Default to current date
            const now = new Date();
            dateValue = now.toISOString().split('T')[0];
            
            // Default time to current time
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            timeValue = `${hours}:${minutes}`;
        }
    }
    
    // Update the combined value when date or time changes
    function updateValue() {
        // Combine date and time into ISO format
        if (dateValue) {
            const [hours, minutes] = timeValue ? timeValue.split(':') : ['00', '00'];
            const isoString = `${dateValue}T${hours}:${minutes}:00`;
            value = isoString;

            const changeEvent = new CustomEvent('change', { 
                detail: { datetime: isoString },
                bubbles: true
            });

            const element = document.getElementById(id);
            if (element) {
                element.dispatchEvent(changeEvent);
            }
        }
    }
    
    function handleTimeChange(event) {
        timeValue = event.detail.time;
        updateValue();
    }
</script>

<style>
    .datetime-picker {
        display: flex;
        flex-direction: column;
        gap: 15px;
        margin-bottom: 15px;
    }
    
    .date-picker {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    
    .date-label {
        font-weight: bold;
        margin-bottom: 5px;
    }
    
    input[type="date"] {
        padding: 8px;
        border-radius: 4px;
        border: 1px solid #96616B;
        background-color: #FFEAD0;
        color: #96616B;
        font-size: 14px;
    }
    
    input[type="date"]:focus {
        outline: none;
        border-color: #7a4e56;
    }
    
    @media (max-width: 767px) {
        .datetime-picker {
            gap: 10px;
        }
        
        input[type="date"] {
            padding: 10px 8px;
            font-size: 16px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
        }
    }
    
    @media (max-width: 480px) {
        .date-label {
            font-size: 14px;
        }
        
        input[type="date"] {
            padding: 8px;
        }
    }
</style>

<div class="datetime-picker" id={id}>
    <div class="date-picker">
        <label for={`${id}-date`} class="date-label">Date {required ? '*' : ''}</label>
        <input 
            type="date" 
            id={`${id}-date`}
            bind:value={dateValue}
            on:change={updateValue}
            required={required}
        />
    </div>

    <TimePicker 
        id={`${id}-time`}
        bind:value={timeValue}
        label="Time"
        required={required}
        on:change={handleTimeChange}
    />
</div>