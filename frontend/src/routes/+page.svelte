<script>
    import Calendar from '$lib/calendar.svelte';
    import AddEventForm from '$lib/addEvent.svelte';
    import AddChoreForm from '$lib/addChore.svelte';
	import Chores from '$lib/chores.svelte';
    
    export let data;
    let events = data.events;
    // let chores = data.chores;
    let rooms = data.rooms;
    
    let pages = {
        calendar:   0,
        chores:     1,
        addEvent:   2,
        addChore:   3,
    };

    let pageNames = [
        'calendar',
        'chores',
        'addEvent',
        'addChore',
    ];

	let viewMode = 0;

    import { browser } from '$app/environment';
    const updateViewMode = (value) => {
        if (browser) {
            if (window.history.state.viewMode != value)
                window.history.pushState({viewMode: value}, '', pageNames[value])
        }
        viewMode = value
    }

    const handlePopState = (event) => {
        if (event.state && event.state.viewMode !== undefined) {
            viewMode = event.state.viewMode;
        } else {
            viewMode = pages.calendar;
        }
    };

    import { onMount } from 'svelte';
    onMount(() => {
        if (browser) {
            // Initialize the viewMode from the current state if exists
            const currentState = window.history.state;
            if (currentState && currentState.viewMode !== undefined) {
                updateViewMode(currentState.viewMode);
            } else {
                updateViewMode(pages.calendar);
            }
            window.addEventListener('popstate', handlePopState);
        }
    });

</script>

{ #if viewMode == pages.calendar }
<div style="display:flex; flex-direction: column; align-items: center;">
    <h1>Event Calendar</h1>
    <div>
        <button on:click={() => updateViewMode(pages.calendar)}>Calendar</button>
        <button on:click={() => updateViewMode(pages.chores)}>Chores</button>
    </div>
</div>

<div style="width:90%; margin: 0 auto">
    <Calendar events={events}/>
</div>

<div>
    <button style="
        height: 50px;
        width: 50px;
        font-size: 2rem;
        background-color: #6544cf;
        border-radius: 50%;
        position: fixed;
        bottom: 40px;
        right: 40px;
        " on:click={() => updateViewMode(pages.addEvent)}>+</button>
</div>

{:else if viewMode == pages.addEvent}

<AddEventForm />

{:else if viewMode == pages.chores}

<div style="display:flex; flex-direction: column; align-items: center;">
    <h1>Event Calendar</h1>
    <div>
        <button on:click={() => updateViewMode(pages.calendar)}>Calendar</button>
        <button on:click={() => updateViewMode(pages.chores)}>Chores</button>
    </div>
</div>

<div style="width:90%; margin: 30px auto">
    <Chores/>
</div>

<div>
    <button style="
        height: 50px;
        width: 50px;
        font-size: 2rem;
        background-color: #6544cf;
        border-radius: 50%;
        position: fixed;
        bottom: 40px;
        right: 40px;
        " on:click={() => updateViewMode(pages.addChore)}>+</button>
</div>

{:else if viewMode == pages.addChore}

<AddChoreForm rooms={rooms} />

{:else}

{viewMode}

{ /if }