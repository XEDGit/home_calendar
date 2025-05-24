<script>
	import Stats from '$lib/menus/stats/stats.svelte';
	import Calendar from '$lib/menus/calendar/calendar.svelte';
	import AddEventForm from '$lib/menus/calendar/addEvent.svelte';
	import AddTodoForm from '$lib/menus/todo/addTodo.svelte';
	import AddChoreForm from '$lib/menus/chores/addChore.svelte';
	import Chores from '$lib/menus/chores/chores.svelte';
	import PlusButton from '$lib/buttons/plusButton.svelte';
	import NavButton from '$lib/header/navButton.svelte';
	import PromptUser from "$lib/prompts/promptUser.svelte";
	import Settings from '$lib/menus/settings/Settings.svelte';
	import Home from '$lib/menus/home/home.svelte';
	import Todo from '$lib/menus/todo/todo.svelte';
	import { onMount, setContext } from 'svelte';
	import { getRooms, getUsers } from '$lib/requests';
	import { getCookie, setCookie } from '$lib/helpers/getCookie';
	import ContentLayout from '$lib/containers/contentLayout.svelte';

	let events = null;
	let chores = null;
	let rooms = null;
	let user = undefined;
	let users = undefined;
	let loading = true;
	
	let pages = {
		home:       0,
		calendar:	1,
		chores:		2,
		addEvent:	3,
		addChore:	4,
		settings:	5,
		todo:		6,
		stats:		7,
		addTodo:	8,
	};

	let pageNames = [
		'home',
		'calendar',
		'chores',
		'addEvent',
		'addChore',
		'settings',
		'todo',
		'stats',
		'addTodo',
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
	import Section from '$lib/header/Section.svelte';
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
			viewMode = pages.home;
		}
	};

	function updateCookies() {
		const date = new Date();
		date.setTime(date.getTime() + (1000 * 24 * 60 * 60 * 1000));
		const expires = "expires=" + date.toUTCString();
		if (user && !users.find((u) => u._id == user)) {
			// Reset cookie if user is not found
			setCookie('user', '', -1000)
			user = undefined;
		}
		if (!user && users.length == 1) {
			// Set single cookie
			user = users[0]._id;
			setCookie('user', users[0]._id, expires)
		}
		// Renew cookies
		const cookies = document.cookie.split('; ');
		for (let i = 0; i < cookies.length; i++) {
			const [cookieName, cookieValue] = cookies[i].split('=');
			setCookie(cookieName, cookieValue, expires);
		}
	}

	async function updateUI() {
		loading = true;
		user = getCookie('user')
		users = await getUsers()
		rooms = await getRooms()
		if (!users.length) {
			viewMode = pages.settings
		}
		updateCookies()
		loading = false;
	}

	setContext('updateUI', updateUI)

	onMount(async () => {
		if (browser) {
			window.addEventListener('popstate', handlePopState);
			// Add listener for our custom viewModeChanged event
			window.addEventListener('viewModeChanged', (event) => {
				if (event.detail !== undefined) {
					updateViewMode(event.detail);
				}
			});
		}
		await updateUI()
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

	function formatPageName(name) {
		return name.replace(/([a-z])([A-Z])/g, '$1 $2')
	}
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
		font-family: 'Roboto', sans-serif;
		color: #113537;
	}
</style>
</svelte:head>

<div style='display: flex; gap: 10px; align-content: center;'>
	<img style='height: 50px;' src='icon_big_nobg.png' />
	{#if user && users && users.length}
		<div>
			<small style="display: block; font-size: 0.7em; color: gray; margin: 0; margin-bottom: -6px">{greet[1]}</small>
			<Section title='{greet[0]} {users.filter((u) => {return user == u._id})[0]?.name || ''} :)' />
		</div>
	{/if}
</div>

<NavButton
	active={viewMode}
	f = {updateViewMode}
	buttons = {{
		"home": pages.home,
		"calendar": pages.calendar,
		"chores": pages.chores,
		"todo": pages.todo,
		"stats": pages.stats,
		"settings": pages.settings,
	}}
	disableMask = {[false, false, false, false, false, false]}
/>

<title>Home Calendar</title>
{#if !user && users && users.length > 1}
	<ContentLayout title={formatPageName(pageNames[viewMode])}>
		<PromptUser buttons={users} onSubmit={(value) => {setCookie('user', value, 100); updateUI()}} />
	</ContentLayout>
{:else if loading}
	<ContentLayout title={formatPageName(pageNames[viewMode])} loading={true} />
{:else}
	<ContentLayout title={formatPageName(pageNames[viewMode])}>
		{#if viewMode == pages.home}
			<Home />
		{:else if viewMode == pages.calendar}
			<Calendar events={events}/>
			<PlusButton func={() => updateViewMode(pages.addEvent)} />
		{:else if viewMode == pages.addEvent}
			<AddEventForm />
		{:else if viewMode == pages.chores}
			<Chores chores={chores}/>
			{#if Object.keys(rooms || {})?.length}
				<PlusButton func={() => updateViewMode(pages.addChore)} />
			{/if}
		{:else if viewMode == pages.addChore}
			<AddChoreForm />
		{:else if viewMode == pages.settings}
			<Settings user_id={user} />
		{:else if viewMode == pages.todo}
			<Todo />
			<PlusButton func={() => updateViewMode(pages.addTodo)} />
		{:else if viewMode == pages.addTodo}
			<AddTodoForm />
		{:else if viewMode == pages.stats}
			<Stats />
		{:else}
			<p>Error: Unknown view mode: {viewMode}</p>
		{/if}
	</ContentLayout>
{/if}

<div style="margin-bottom: 28vh;"></div>