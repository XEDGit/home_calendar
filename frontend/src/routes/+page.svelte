<script>
	import Stats from '$lib/menus/stats/stats.svelte';
	import Calendar from '$lib/menus/calendar/calendar.svelte';
	import AddEventForm from '$lib/menus/calendar/addEvent.svelte';
	import AddChoreForm from '$lib/menus/chores/addChore.svelte';
	import Chores from '$lib/menus/chores/chores.svelte';
	import PlusButton from '$lib/buttons/plusButton.svelte';
	import NavButton from '$lib/header/navButton.svelte';
	import PromptUser from "$lib/prompts/promptUser.svelte";
	import Settings from '$lib/menus/settings/Settings.svelte';
	import { onMount } from 'svelte';
	import { getUsers } from '$lib/requests';

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
		return null;
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
		settings:	4,
		notes:	5,
		stats:		6,
	};

	let pageNames = [
		'calendar',
		'chores',
		'addEvent',
		'addChore',
		'settings',
		'shopping-list',
		'stats',
	];

	let viewMode = 1;

	import { browser } from '$app/environment';
	const updateViewMode = (value) => {
		if (browser) {
			if (window.history.state.viewMode != value)
				window.history.pushState({viewMode: value}, '', pageNames[value])
		}
		viewMode = value
	}

	import { page } from '$app/stores';
	import Section from '../lib/header/Section.svelte';
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

	let users = null
	onMount(async () => {
		if (browser) {
			window.addEventListener('popstate', handlePopState);
			user = getCookie('user')
		}
		users = await getUsers()
		if (!users.length) {
			viewMode = pages.settings
		}
	});


	const greetings = {
		"Hello": "(hɛˈloʊ) in English",
		"Hi": "(haɪ) in English",
		"Hey": "(heɪ) in English",
		"Howdy": "(ˈhaʊdi) in English",
		"Greetings": "(ˈɡriːtɪŋz) in English",
		"Salutations": "(ˌsæljʊˈteɪʃənz) in English",
		"Hola": "(ˈoːla) in Spanish",
		"Bonjour": "(bɔ̃ʒuʁ) in French",
		"Ciao": "(ˈtʃa.o) in Italian",
		"Buongiorno": "(ˌbwonˈdʒɔrno) in Italian",
		"Hoi": "(hɔi) in Dutch",
		"Goededag": "(ˈɣutəˌdɑx) in Dutch",
		"Hallo": "(ˈhalːo) in German",
		"Привет": "(prʲɪˈvʲet) in Russian",
		"Zdravstvuyte": "(zdrɑvˈstvʊjɪtʲɛ) in Russian",
		"こんにちは": "(konnichiwa) in Japanese",
		"안녕하세요": "(an-nyeong-ha-se-yo) in Korean",
		"你好": "(nǐ hǎo) in Chinese",
		"Olá": "(oˈla) in Portuguese",
		"Hej": "(jei) in Swedish",
		"Shalom": "(ʃaˈlɔm) in Hebrew",
		"Ahoj": "(ˈahoj) in Czech",
		"Merhaba": "(ˈmɛɾhaba) in Turkish",
		"Kamusta": "(kaˈmusˈta) in Filipino (Tagalog)",
		"Szia": "(ˈsiːɒ) in Hungarian",
		"Witam": "(ˈvʲitam) in Polish",
		"Sawubona": "(sawuˈbona) in Zulu",
		"Yassas": "(ˈjasas) in Greek",
		"As-salamu alaykum": "(æs sæˈlɑːmu æˈlæj.kʊm) in Arabic",
		"Tere": "(ˈtere) in Estonian",
		"Salut": "(saˈlut) in Romanian",
		"Hai Noroc": "(haj noˈrok) in Romanian",
		"Buna Ziua": "(ˈbuna ˈzi.wa) in Romanian",
		"Dia duit": "(dʲiːə dʷɪtʲ) in Irish",
		"Kia ora": "(kiˈa ɔɾa) in Maori",
		"Jambo": "(ˈdʒɑːm.boʊ) in Swahili",
		"Hei": "(hei) in Finnish",
		"Chào": "(ʈʃaːo) in Vietnamese",
		"Selam": "(ˈsɛlɑm) in Somali",
		"Moin": "(mɔɪn) in North German",
		"Bok": "(bɔk) in Croatian",
		"Terve": "(ˈtɛɾʋɛ) in Finnish",
		"Habari": "(haˈbɑːɾi) in Swahili",
		"Cześć": "(t͡ʂɛɕt͡ɕ) in Polish",
		"Salutare": "(saˈluːtɑːɾɛ) in Albanian",
		"Konnichiwa": "(konnichiwa) in Japanese"
	};

	const greetings_len = Object.keys(greetings).length

	function pickGreeting() {
		const i = Math.floor(Math.random() * greetings_len)
		return Object.entries(greetings)[i]
	}

	const greet = pickGreeting()
</script>

<svelte:head>
	<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
<style>
	* {
		transition: all 0.3s;
	}

	body {
		background-color: #FFEAD0;
		margin: 0, 0;
		overflow-x: hidden;
		height: 100%;
		width: 95%;
		font-family: 'Roboto', sans-serif;
		color: #113537;
	}
</style>
</svelte:head>

{#if user && users && users.length}
<small style="display: block; font-size: 0.7em; color: gray; margin: 0; margin-bottom: -6px">{greet[1]}</small>
<Section title='{greet[0]} {users.filter((u) => {return user == u._id})[0].name} :)' />
{/if}

<NavButton
	f = {updateViewMode}
	buttons = {{
		"calendar": pages.calendar,
		"chores": pages.chores,
		"stats": pages.stats,
		"notes": pages.notes,
		"settings": pages.settings,
	}}
	disableMask = {[true, false, false, true, false]}
/>


{#if !user && users && users.length}
<PromptUser buttons={users} onSubmit={(value) => {setCookie('user', value, 1)}} />

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

<AddChoreForm />

{:else if viewMode == pages.settings}

<Settings user_id={user} />

{:else if viewMode == pages.notes}

<Shoppinglist />

{:else if viewMode == pages.stats}

<Stats />

{:else}

{viewMode}

{ /if }

<div style="margin-bottom: 28vh;"></div>