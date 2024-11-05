<script>
    import Calendar from '$lib/calendar.svelte';
    import AddEventForm from '$lib/addEvent.svelte';
    import AddChoreForm from '$lib/addChore.svelte';
	import Chores from '$lib/chores.svelte';
    import PlusButton from '$lib/plusButton.svelte';
    import NavButton from '$lib/navButton.svelte';
	import PromptUser from "$lib/promptUser.svelte";
	import { onMount } from 'svelte';

    export let data;
    let events = data.events;
    let chores = data.chores;
    let rooms = data.rooms;
	let user = undefined;

	function getCookie(name) {
	    const cookieArr = document.cookie.split(';');
	    for (let i = 0; i < cookieArr.length; i++) {
			let cookie = cookieArr[i].trim();
			if (cookie.startsWith(name + '=')) {
				return cookie.substring(name.length + 1, cookie.length);
			}
	    }
	    return null; // Return null if cookie not found
	}
	function setCookie(name, value, days) {
		const date = new Date();
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000)); // Expiry in days
		const expires = `expires=${date.toUTCString()}`;
		document.cookie = `${name}=${value}; ${expires}; path=/`; // Setting the cookie
		user = value
	}
    
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

    import { page } from '$app/stores';
    let queryParams = $page.url.searchParams;
    for (let [key, value] of Array.from(queryParams.entries())) {
        if (key == 'viewMode') {
            let idx = pageNames.indexOf(value)
            if (value != -1)
                updateViewMode(idx)
        }
    }


    const handlePopState = (event) => {
        if (event.state && event.state.viewMode !== undefined) {
            viewMode = event.state.viewMode;
        } else {
            viewMode = pages.calendar;
        }
    };

    onMount(() => {
        if (browser) {
            window.addEventListener('popstate', handlePopState);
			user = getCookie('user')
        }
    });

</script>

<svelte:head>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
<style>
    body {
        background-color: #FFEAD0;
        margin: 0, 0;
		overflow: hidden;
        height: 100%;
        width: 100%;
        font-family: 'Roboto', sans-serif;
        color: #113537;
    }
    .navButton {
        border: none;
        border-radius: 20px;
        width: 10vw;
        min-width: 40vw;
        height: 8vh;
        min-height: 8vh;
        font-weight: bold;
        font-size: 24px;
        transition: box-shadow 0.5s,
        background-color 0.5s,
        border-radius 0.5s,
        color 0.5s;
        background-color: #96616B;
        color: #FFEAD0;
    }
    .navButton:hover {
        background-color: #37505C;
        color: white;
        border-radius: 30px;
        box-shadow: 0 7px 15px rgba(0, 0, 0, 0.3);
    }
    .navBar {
        height: 12vh;
        display: flex;
        gap: 10vw;
    }
</style>
</svelte:head>

<NavButton fcal={() => updateViewMode(pages.calendar)} fcho={() => updateViewMode(pages.chores)} />

{#if !user}

<PromptUser onSubmit={(value) => {setCookie('user', value, 1)}} />

{:else if viewMode == pages.calendar }

<div style="width:90%; margin: 0 auto">
    <Calendar events={events}/>
</div>

<PlusButton func={() => updateViewMode(pages.addEvent)} />

{:else if viewMode == pages.addEvent}

<AddEventForm />

{:else if viewMode == pages.chores}

<div style="width:90%; margin: 0 auto">
    <Chores chores={chores}/>
</div>

<PlusButton func={() => updateViewMode(pages.addChore)} />

{:else if viewMode == pages.addChore}

<AddChoreForm rooms={rooms} />

{:else}

{viewMode}

{ /if }
