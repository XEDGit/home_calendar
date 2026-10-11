<script>
	import Stats from "$lib/menus/stats/stats.svelte";
	import Calendar from "$lib/menus/calendar/calendar.svelte";
	import AddChoreForm from "$lib/menus/chores/addChore.svelte";
	import Chores from "$lib/menus/chores/chores.svelte";
	import PlusButton from "$lib/buttons/plusButton.svelte";
	import NavButton from "$lib/header/navButton.svelte";
	import PromptUser from "$lib/prompts/promptUser.svelte";
	import Settings from "$lib/menus/settings/Settings.svelte";
	import Home from "$lib/menus/home/home.svelte";
	import Todo from "$lib/menus/todo/todo.svelte";
	import Automations from "$lib/menus/automations/automations.svelte";
	import AddAutomationForm from "$lib/menus/automations/addAutomation.svelte";
	import AssistantTab from "$lib/menus/assistant/assistant.svelte";
	import Intro from "$lib/intro/Intro.svelte";
	import { connect, unreadCount } from "$lib/assistant/store.js";
	import { onMount, setContext, tick } from "svelte";
	import { getRooms, getUsers } from "$lib/requests";
	import { getCookie, setCookie } from "$lib/helpers/getCookie";
	import ContentLayout from "$lib/containers/contentLayout.svelte";
	import Screen from "$lib/containers/screen.svelte";
	import { viewTransition } from "$lib/motion";
	import { applyTheme } from "$lib/theme";

	let rooms = null;
	let user = undefined;
	let users = undefined;
	let loading = true;
	// A household with no members yet gets the welcome intro instead of the tabs
	let setup = false;

	let pages = {
		home: 0,
		calendar: 1,
		chores: 2,
		addEvent: 3,
		addChore: 4,
		settings: 5,
		todo: 6,
		stats: 7,
		addTodo: 8,
		automations: 9,
		addAutomation: 10,
		assistant: 11,
	};

	let pageNames = [
		"home",
		"calendar",
		"chores",
		"addEvent",
		"addChore",
		"settings",
		"todo",
		"stats",
		"addTodo",
		"automations",
		"addAutomation",
		"assistant",
	];

	let viewMode = 0;
	$: view = pageNames[viewMode];

	// One assistant stream per page, for the member picked on this device
	$: if (browser && user && !loading) connect(user);

	// Spatial model for page changes: the screens sit in a row in nav order,
	// each form just right of the tab it belongs to. Changing screen pushes
	// sideways along that row: a screen further right slides in from the
	// right, going back slides in from the left.
	const FORM_PARENT = { [pages.addChore]: pages.chores, [pages.addAutomation]: pages.automations };
	// Adding an event or a todo is a sheet over its tab, not a page; the old
	// /addEvent and /addTodo addresses open that sheet on the tab
	const ADD_ON = { [pages.addEvent]: pages.calendar, [pages.addTodo]: pages.todo };
	const TABS = ["home", "assistant", "calendar", "chores", "todo", "stats", "automations", "settings"];

	const isForm = (value) => value in FORM_PARENT;

	function orderOf(value) {
		return isForm(value)
			? TABS.indexOf(pageNames[FORM_PARENT[value]]) + 0.5
			: TABS.indexOf(pageNames[value]);
	}

	// Tabs stay mounted once opened (hidden when out of view), so coming back
	// to one shows it at once, as you left it, and it refreshes in place.
	// Forms start fresh every time.
	let alive = {};
	const scrollMemory = {};

	function keepAlive(value) {
		if (!isForm(value)) alive[pageNames[value]] = true;
	}

	// Tabs whose first data is in (each view reports it through onReady)
	let loadedTabs = {};
	let readyWaiters = {};

	function markReady(tab) {
		loadedTabs[tab] = true;
		for (const resolve of readyWaiters[tab] ?? []) resolve();
		delete readyWaiters[tab];
	}

	function whenReady(tab, maxWait) {
		if (loadedTabs[tab]) return Promise.resolve();
		return Promise.race([
			new Promise((resolve) => (readyWaiters[tab] ??= []).push(resolve)),
			new Promise((resolve) => setTimeout(resolve, maxWait)),
		]);
	}

	function showView(value) {
		if (value === viewMode) return;
		const dir = orderOf(value) > orderOf(viewMode) ? "forward" : "back";
		scrollMemory[viewMode] = window.scrollY;
		keepAlive(viewMode);
		viewTransition(
			async () => {
				keepAlive(value);
				viewMode = value;
				await tick();
				// A tab whose first data isn't in yet (opened moments ago) holds
				// the change briefly, so it slides in whole instead of filling
				// in afterwards. A loaded tab goes at once.
				if (!isForm(value)) await whenReady(pageNames[value], 600);
				// Tabs come back scrolled where you left them; forms open at the top
				window.scrollTo(0, isForm(value) ? 0 : (scrollMemory[value] ?? 0));
			},
			// A form waits a moment for its own data too
			{ scope: "page", dir, settle: isForm(value) ? 600 : 0 },
		);
	}

	// Once the first screen is up, open the other tabs in the background,
	// one at a time while the device is idle, so each has its data before
	// it's first visited
	let warmTimer;
	function warmUp() {
		clearTimeout(warmTimer);
		keepAlive(viewMode);
		const idle = (fn) => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 1500 }) : fn());
		const next = () => {
			const tab = TABS.find((t) => !alive[t]);
			if (!tab || loading) return;
			alive[tab] = true;
			warmTimer = setTimeout(() => idle(next), 100);
		};
		warmTimer = setTimeout(() => idle(next), 200);
	}

	import { browser } from "$app/environment";
	// Tab views that can open their add sheet (bound below), and a tab whose
	// sheet should open once it's on screen with its data in
	let calendarView, todoView;
	let pendingAdd = null;
	$: if (pendingAdd !== null && !loading && viewMode === pendingAdd) openPendingAdd();
	async function openPendingAdd() {
		const tab = pendingAdd;
		pendingAdd = null;
		await whenReady(pageNames[tab], 1500);
		await tick();
		(tab === pages.calendar ? calendarView : todoView)?.openAdd();
	}

	const updateViewMode = (value, { animate = true } = {}) => {
		if (value in ADD_ON) {
			pendingAdd = ADD_ON[value];
			return updateViewMode(ADD_ON[value], { animate });
		}
		if (browser) {
			if (window.history.state?.viewMode != value)
				window.history.pushState(
					{ viewMode: value },
					"",
					pageNames[value],
				);
		}
		if (animate && browser) showView(value);
		else viewMode = value;
	};

	import { page } from "$app/stores";
	import Section from "$lib/header/Section.svelte";
	let queryParams = $page.url.searchParams;
	for (let [key, value] of Array.from(queryParams.entries())) {
		if (key == "viewMode") {
			let idx = pageNames.indexOf(value);
			if (value != -1) updateViewMode(idx, { animate: false });
		}
	}

	// The tab named in the address bar (/calendar, /todo, ...), if any
	function viewFromPath(pathname) {
		const idx = pageNames.indexOf(pathname.replace(/^\/+|\/+$/g, ""));
		return idx >= 0 ? idx : undefined;
	}

	// A tab URL opens straight on that tab (a refresh, a reopened tab)
	const pathView = viewFromPath($page.url.pathname);
	if (pathView in ADD_ON) {
		viewMode = ADD_ON[pathView];
		pendingAdd = viewMode;
	} else if (pathView !== undefined) viewMode = pathView;

	const handlePopState = (event) => {
		const target = event.state?.viewMode ?? viewFromPath(location.pathname) ?? pages.home;
		if (target in ADD_ON) {
			pendingAdd = ADD_ON[target];
			history.replaceState({ viewMode: pendingAdd }, "", pageNames[pendingAdd]);
			showView(pendingAdd);
		} else showView(target);
	};

	function updateCookies() {
		if (user && !users.find((u) => u._id == user)) {
			// Reset cookie if user is not found
			setCookie("user", "", -1000);
			user = undefined;
		}
		// A household of one needs no picking
		if (!user && users.length == 1) user = users[0]._id;
		// The member picked on this device stays picked ~1000 days from the
		// last visit (the theme cookie renews itself in applyTheme)
		if (user) setCookie("user", user, 1000);
	}

	async function updateUI() {
		loading = true;
		// A new session starts from the screen in view; the others warm up after
		alive = {};
		loadedTabs = {};
		readyWaiters = {};
		user = getCookie("user");
		const [fetchedUsers, fetchedRooms] = await Promise.all([getUsers(), getRooms()]);
		users = fetchedUsers;
		rooms = fetchedRooms;
		setup = Array.isArray(users) && users.length === 0;
		updateCookies();
		// First reveal: crossfade from the loading line to the populated page,
		// already in this member's theme (their pick follows them across
		// devices). The first screen's data is waited for, so it arrives whole.
		const me = users.find((u) => u._id == user);
		const showsScreen = !setup && (!!user || users.length <= 1);
		await viewTransition(
			async () => {
				applyTheme(me?.theme);
				loading = false;
				await tick();
				if (showsScreen && !isForm(viewMode)) await whenReady(pageNames[viewMode], 1500);
			},
			{ scope: "reveal", settle: showsScreen && isForm(viewMode) ? 600 : 0 },
		);
		if (!setup) warmUp();
	}

	// The intro is done: the household opens on home, with its new members
	function finishSetup() {
		setup = false;
		viewMode = pages.home;
		history.replaceState({ viewMode }, "", pageNames[viewMode]);
		updateUI();
	}

	setContext("updateUI", updateUI);

	onMount(async () => {
		if (browser) {
			// An old /addEvent or /addTodo address: show the tab's own address
			if (pathView in ADD_ON) history.replaceState({ viewMode }, "", pageNames[viewMode]);
			window.addEventListener("popstate", handlePopState);
			// Add listener for our custom viewModeChanged event
			// detail: a page index, or a page name ("assistant")
			window.addEventListener("viewModeChanged", (event) => {
				const target = typeof event.detail === "string" ? pages[event.detail] : event.detail;
				if (target !== undefined) {
					updateViewMode(target);
				}
			});
		}
		await updateUI();
	});

	const greetings = {
		Hello: "(hɛˈloʊ) in English",
		Hi: "(haɪ) in English",
		Hey: "(heɪ) in English",
		Howdy: "(ˈhaʊdi) in English",
		Greetings: "(ˈɡriːtɪŋz) in English",
		Salutations: "(ˌsæljʊˈteɪʃənz) in English",
		Hola: "(ˈoːla) in Spanish",
		Bonjour: "(bɔ̃ʒuʁ) in French",
		Ciao: "(ˈtʃa.o) in Italian",
		Buongiorno: "(ˌbwonˈdʒɔrno) in Italian",
		Zdravei: "(zdrɐˈvɛj) in Bulgarian",
		Hoi: "(hɔi) in Dutch",
		Goededag: "(ˈɣutəˌdɑx) in Dutch",
		Hallo: "(ˈhalːo) in German",
		Привет: "(prʲɪˈvʲet) in Russian",
		Zdravstvuyte: "(zdrɑvˈstvʊjɪtʲɛ) in Russian",
		こんにちは: "(konnichiwa) in Japanese",
		안녕하세요: "(an-nyeong-ha-se-yo) in Korean",
		你好: "(nǐ hǎo) in Chinese",
		Olá: "(oˈla) in Portuguese",
		Hej: "(jei) in Swedish",
		Shalom: "(ʃaˈlɔm) in Hebrew",
		Ahoj: "(ˈahoj) in Czech",
		Merhaba: "(ˈmɛɾhaba) in Turkish",
		Kamusta: "(kaˈmusˈta) in Filipino (Tagalog)",
		Szia: "(ˈsiːɒ) in Hungarian",
		Witam: "(ˈvʲitam) in Polish",
		Sawubona: "(sawuˈbona) in Zulu",
		Yassas: "(ˈjasas) in Greek",
		"As-salamu alaykum": "(æs sæˈlɑːmu æˈlæj.kʊm) in Arabic",
		Tere: "(ˈtere) in Estonian",
		Salut: "(saˈlut) in Romanian",
		"Hai Noroc": "(haj noˈrok) in Romanian",
		"Buna Ziua": "(ˈbuna ˈzi.wa) in Romanian",
		"Dia duit": "(dʲiːə dʷɪtʲ) in Irish",
		"Kia ora": "(kiˈa ɔɾa) in Maori",
		Jambo: "(ˈdʒɑːm.boʊ) in Swahili",
		Hei: "(hei) in Finnish",
		Chào: "(ʈʃaːo) in Vietnamese",
		Selam: "(ˈsɛlɑm) in Somali",
		Moin: "(mɔɪn) in North German",
		Bok: "(bɔk) in Croatian",
		Terve: "(ˈtɛɾʋɛ) in Finnish",
		Habari: "(haˈbɑːɾi) in Swahili",
		Cześć: "(t͡ʂɛɕt͡ɕ) in Polish",
		Salutare: "(saˈluːtɑːɾɛ) in Albanian",
		Konnichiwa: "(konnichiwa) in Japanese",
	};

	const greetings_len = Object.keys(greetings).length;

	function pickGreeting() {
		const i = Math.floor(Math.random() * greetings_len);
		return Object.entries(greetings)[i];
	}

	const greet = pickGreeting();

	function formatPageName(name) {
		return name.replace(/([a-z])([A-Z])/g, "$1 $2");
	}
</script>

<svelte:head>
	<title>Home Calendar</title>
</svelte:head>

<header class="site-header" style="display: flex; gap: 10px; align-content: center;">
	<span class="site-logo" role="img" aria-label="Home Calendar"></span>
	{#if user && users && users.length && !loading}
		<div>
			<small
				style="display: block; font-size: var(--text-xs); color: var(--primary); margin: 0; margin-bottom: -6px"
				>{greet[1]}</small
			>
			<!-- The smiley is glued to the name so it never wraps onto a line alone -->
			<Section
				title={`${greet[0]} ${users.find((u) => u._id == user)?.name || ''}\u00a0:)`}
			/>
		</div>
	{/if}
</header>

{#if !setup}
<NavButton
	active={viewMode}
	f={updateViewMode}
	buttons={{
		home: pages.home,
		assistant: pages.assistant,
		calendar: pages.calendar,
		chores: pages.chores,
		todo: pages.todo,
		stats: pages.stats,
		automations: pages.automations,
		settings: pages.settings,
	}}
	badges={{ assistant: $unreadCount }}
	disableMask={[false, false, false, false, false, false, false, false]}
/>
{/if}

{#if viewMode < 0 || viewMode >= pageNames.length}
	{updateViewMode(pages.home, { animate: false })}
{/if}

{#if setup && !loading}
	<main>
		<Intro onDone={finishSetup} />
	</main>
{:else if !user && users && users.length > 1}
	<ContentLayout as="main" pageView title={formatPageName(pageNames[viewMode])}>
		<PromptUser
			buttons={users}
			onSubmit={(value) => {
				setCookie("user", value, 100);
				updateUI();
			}}
		/>
	</ContentLayout>
{:else if loading}
	<ContentLayout as="main" pageView title={formatPageName(pageNames[viewMode])} loading={true} />
{:else}
	<main class="screens">
		{#if alive.home || view === "home"}
			<Screen name="home" active={view === "home"}>
				<Home active={view === "home"} onReady={() => markReady("home")} />
			</Screen>
		{/if}
		{#if alive.assistant || view === "assistant"}
			<Screen name="assistant" active={view === "assistant"}>
				<AssistantTab active={view === "assistant"} onReady={() => markReady("assistant")} />
			</Screen>
		{/if}
		{#if alive.calendar || view === "calendar"}
			<Screen name="calendar" active={view === "calendar"}>
				<Calendar bind:this={calendarView} active={view === "calendar"} onReady={() => markReady("calendar")} />
				<PlusButton func={() => calendarView?.openAdd()} />
			</Screen>
		{/if}
		{#if alive.chores || view === "chores"}
			<Screen name="chores" active={view === "chores"}>
				<Chores active={view === "chores"} onReady={() => markReady("chores")} />
				{#if Object.keys(rooms || {})?.length}
					<PlusButton func={() => updateViewMode(pages.addChore)} />
				{/if}
			</Screen>
		{/if}
		{#if alive.todo || view === "todo"}
			<Screen name="todo" active={view === "todo"}>
				<Todo bind:this={todoView} active={view === "todo"} onReady={() => markReady("todo")} />
				<PlusButton func={() => todoView?.openAdd()} />
			</Screen>
		{/if}
		{#if alive.stats || view === "stats"}
			<Screen name="stats" active={view === "stats"}>
				<Stats active={view === "stats"} onReady={() => markReady("stats")} />
			</Screen>
		{/if}
		{#if alive.automations || view === "automations"}
			<Screen name="automations" active={view === "automations"}>
				<Automations active={view === "automations"} onReady={() => markReady("automations")} />
				<PlusButton func={() => updateViewMode(pages.addAutomation)} />
			</Screen>
		{/if}
		{#if alive.settings || view === "settings"}
			<Screen name="settings" active={view === "settings"}>
				<Settings user_id={user} active={view === "settings"} onReady={() => markReady("settings")} />
			</Screen>
		{/if}
		{#if view === "addChore"}
			<Screen name="addChore" active><AddChoreForm /></Screen>
		{:else if view === "addAutomation"}
			<Screen name="addAutomation" active><AddAutomationForm /></Screen>
		{/if}
	</main>
{/if}

<!-- Room to scroll the last rows clear of the + button. The Assistant tab
     already fills the screen exactly, so there it would only add an empty
     band below the input and let the page scroll the nav away. -->
{#if view !== "assistant"}<div style="margin-bottom: 28vh;"></div>{/if}
