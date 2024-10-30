<script>
    import Calendar from '$lib/calendar.svelte';
    import AddEventForm from '$lib/addEvent.svelte';
    import AddChoreForm from '$lib/addChore.svelte';
	import Chores from '$lib/chores.svelte';
    
    export let data;
    let events = data.events;
    let chores = data.chores;
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

<svelte:head>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
<style>
    body {
        background-color: #5961EB;
        margin: 0;
        height: 100%;
        width: 100%;
        font-family: 'Roboto', sans-serif;
    }
    .navButton {
        background-color: #8159EB;
        border: none;
        border-radius: 20px;
        width: 10vw;
        height: 4vh;
        font-size: 16px;
        transition: box-shadow 0.5s, background-color 0.5s;
    }
    .navButton:hover {
        background-color: #B159EB;
        border-radius: 30px;
        box-shadow: 0 7px 15px rgba(0, 0, 0, 0.3);
    }
    .navBar {
        height: 12vh;
        display: flex;
        gap: 100px
    }
</style>
</svelte:head>

{ #if viewMode == pages.calendar }
<div style="display:flex; flex-direction: column; align-items: center;">
    <h1>Event Calendar</h1>
    <div class="navBar">
        <button class="navButton" on:click={() => updateViewMode(pages.calendar)}>Calendar</button>
        <button class="navButton" on:click={() => updateViewMode(pages.chores)}>Chores</button>
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
        background-color: #B159EB;
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
    <div class="navBar">
        <button class="navButton" on:click={() => updateViewMode(pages.calendar)}>Calendar</button>
        <button class="navButton" on:click={() => updateViewMode(pages.chores)}>Chores</button>
    </div>
</div>

<div style="width:90%; margin: 30px auto">
    <Chores chores={chores}/>
</div>

<div>
    <button style="
        height: 50px;
        width: 50px;
        font-size: 2rem;
        background-color: #B159EB;
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
