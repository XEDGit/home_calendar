<script>
	import Form from "$lib/prompts/form.svelte";
	import Section from "$lib/header/Section.svelte";
	import { onMount } from "svelte";
	import { getUsers, getRooms, getTags, postFrontend, updateTheme, logout } from "$lib/requests.js";
	import PasswordSheet from "$lib/sheet/PasswordSheet.svelte";
	import ThemePicker from "$lib/components/ThemePicker.svelte";
    import ColorPicker from "svelte-awesome-color-picker";
    import Collapsible from "$lib/containers/collapsible.svelte";
	import { reveal, vanish, move, expand, viewTransition } from "$lib/motion";
	import { DEFAULT_THEME, themeById, applyTheme } from "$lib/theme";
	import { setCookie } from "$lib/helpers/getCookie";

	let changingPassword = false

	async function logOut() {
		// The login cookie is httpOnly: only the server can drop it
		await logout().catch(() => {})
		setCookie('user', '', -1000)
		document.location = '/login'
	}

	export let user_id = '';
	let users = []
	let rooms = []
	let tags = []
	let own_color = 'red';

	async function updateUsers() {
		users = await getUsers()
		const me = users.find((u) => u._id == user_id)
		own_color = me?.color
		currentTheme = savedTheme = themeById(me?.theme).id
		assistantConfirm = me?.assistantConfirm !== false
	}

	// ── Assistant ──────────────────────────────────────────────────────────
	// Per member: review the assistant's changes before they run (default)
	// or let it act on its own. A failed save flips the switch back.
	let assistantConfirm = true
	let assistantError = ''

	async function setAssistantConfirm(value) {
		assistantConfirm = value
		assistantError = ''
		try {
			const res = await postFrontend('assistantSetting', { confirm: value })
			if (res?.error) throw new Error(res.error)
		} catch {
			assistantConfirm = !value
			assistantError = "Couldn't save this setting. Try again in a moment."
		}
	}

	// ── Theme ──────────────────────────────────────────────────────────────
	// Each member picks their own palette. It applies at once (crossfade) and
	// saves shortly after, so arrowing through the options doesn't flood the
	// server. A failed save puts the last saved theme back.
	$: me = users.find((u) => u._id == user_id)
	let currentTheme = DEFAULT_THEME
	let savedTheme = DEFAULT_THEME
	let themeError = ''
	let saveTimer

	function showTheme(id) {
		viewTransition(() => applyTheme(id), { scope: 'theme', dir: 'fade' })
	}

	function chooseTheme(id) {
		if (id === currentTheme) return
		currentTheme = id
		themeError = ''
		showTheme(id)
		clearTimeout(saveTimer)
		saveTimer = setTimeout(() => saveTheme(id), 400)
	}

	async function saveTheme(id) {
		try {
			const res = await updateTheme(id)
			if (res?.error) throw new Error(res.error)
			savedTheme = id
		} catch {
			if (currentTheme !== id) return
			currentTheme = savedTheme
			showTheme(savedTheme)
			themeError = "Couldn't save your theme, so the previous one is back. Try again in a moment."
		}
	}

	async function updateRooms() {
		rooms = await getRooms()
	}

	async function updateTags() {
		tags = await getTags()
	}

	// Render once everything has loaded, so the "add your name" prompts
	// never flash before the household's data arrives
	let ready = false;

	// Called once the first data is in, so the page knows this tab can
	// slide in whole
	export let onReady = () => {};

	onMount(async () => {
		await Promise.all([updateRooms(), updateUsers(), updateTags()])
		ready = true
		onReady()
	})

	// Kept alive in the background between visits: coming back to this tab
	// refreshes it in place
	export let active = true;
	let wasActive = active;
	$: onActiveChange(active);
	function onActiveChange(isActive) {
		if (isActive && !wasActive && ready) Promise.all([updateRooms(), updateUsers(), updateTags()]);
		wasActive = isActive;
	}
</script>

<style>
	.container {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-sm);
		box-sizing: border-box;
		margin: 15px 15px;
		margin-bottom: 15px;
		background-color: var(--primary);
		width: 50%;
		min-width: 80vw;
		max-width: calc(100% - 30px);
		border-radius: var(--radius-md);
		padding: 2px 10px;
	}

	/* The row's Delete button sits on the row's own colour: give it an edge
	 * so it reads as a button without hover (phones) */
	.container :global(.main-container button) {
		border-color: var(--paper-a60);
	}

	p {
		color: var(--paper);
		align-content: center;
		margin: 0;
	}

	.tooltip {
		color: var(--primary);
		font-style: italic;
		margin-bottom: 20px;
	}

	/* Wraps on phones with room between the rows */
	.userActions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm) var(--space-md);
		padding-left: var(--space-md);
	}

	.userAction {
		border-radius: var(--radius-md);
		padding: var(--control-pad-y) var(--control-pad-x);
		min-height: var(--control-min-h);
		color: var(--paper);
		border: var(--bw) solid var(--primary);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.userAction:hover {
			background-color: var(--paper);
			color: var(--primary);
		}
	}

	.spacer {
		height: 20px;
	}

	.assistant-toggle {
		display: flex;
		gap: var(--space-sm);
		align-items: flex-start;
		max-width: var(--measure);
		margin: 0 0 var(--space-sm);
		cursor: pointer;
	}

	.assistant-toggle input {
		width: 20px;
		height: 20px;
		margin-top: 2px;
		flex-shrink: 0;
		accent-color: var(--primary);
	}

	.toggle-title {
		display: block;
		font-weight: var(--weight-bold);
		color: var(--primary);
	}

	.toggle-hint {
		display: block;
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
		color: var(--ink);
	}

	.theme-error {
		color: var(--urgent);
		font-weight: var(--weight-bold);
		margin: 0 0 var(--space-sm);
	}

	@media (max-width: 480px) {
		/* Rows use the full width of their list */
		.container {
			width: auto;
			min-width: 0;
			max-width: none;
			margin: 10px 0;
		}
	}
</style>

{#if ready}
<div in:reveal>
	{#if me}
		<Section title='Your theme' subtitle="Just for {me.name}, on every device" />
		<ThemePicker current={currentTheme} label="Theme for {me.name}" onPick={chooseTheme} />
		{#if themeError}
			<p class="theme-error" role="alert" transition:expand>{themeError}</p>
		{/if}
		<div class='spacer'></div>

		<Section title='Assistant' subtitle="Just for {me.name}" />
		<label class="assistant-toggle">
			<input
				type="checkbox"
				checked={assistantConfirm}
				on:change={(e) => setAssistantConfirm(e.currentTarget.checked)}
			/>
			<span>
				<span class="toggle-title">Show me the changes before they happen</span>
				<span class="toggle-hint">
					{assistantConfirm
						? 'The assistant lists everything it plans to change and waits for your OK.'
						: 'The assistant makes changes right away and tells you what it did.'}
				</span>
			</span>
		</label>
		{#if assistantError}
			<p class="theme-error" role="alert" transition:expand>{assistantError}</p>
		{/if}
		<div class='spacer'></div>
	{/if}

	<Section title='Users' />
	{#if !users.length}
		<p class='tooltip'>I don't know who you are!</p>
		<p class='tooltip'>Please add your name here</p>
		<Form
			endpoint='addUser'
			inputs={[{name: 'Name:', type: 'text', id: 'name', }, {name: 'Color:', type: 'color', id: 'color', value: '#' + Math.round(Math.random() * 0xffffff).toString(16).padEnd(6, 0)}]}
			colorText='Color:'
			submitText='Add'
			width='50%'
			hook={() => {if (!users?.length) document.location = '/settings'; updateUsers()}}
		/>
	{:else}
		<Collapsible title='Click here to show users'>
			{#each users as user (user._id)}
			<div class='container' animate:move in:reveal out:vanish>
				{#if user._id == user_id}
				<div style='display: flex; gap: 10px; align-items: center;'>
					<p>{user.name}</p>
					<ColorPicker label='' bind:hex={own_color} on:input={(e) => {postFrontend('updateUser', {color: e.detail.hex});}} ></ColorPicker>
				</div>
				{:else}
					<p>{user.name}</p>
				{/if}
				<Form
					endpoint='delUser'
					ask_confirm={"Warning: are you sure you want to delete the user named '" + user.name + "'? This will also delete ALL the statistics about them, this is not revertible"}
					submitText='Delete'
					inputs={[{value: user._id.toString(), type: 'text', id: 'id', type: 'hidden'}]}
					hook={updateUsers}
				/>
			</div>
			{/each}
			<Form
				endpoint='addUser'
				inputs={[{name: 'Name:', type: 'text', id: 'name', }, {name: 'Color:', type: 'color', id: 'color', value: '#' + Math.round(Math.random() * 0xffffff).toString(16).padEnd(6, 0)}]}
				colorText='Color:'
				submitText='Add'
				width='50%'
				hook={() => {if (!users?.length) document.location = '/settings'; updateUsers()}}
			/>
		</Collapsible>
	{/if}

	<div class='spacer'></div>
	<Section title='Rooms' subtitle='add or remove rooms from your household' />
	{#if !rooms.length}
		<p class='tooltip'>You have rooms in your home? Then add their names in here!</p>
		<p class='tooltip'>Later you will be able to assign tasks to specific rooms</p>
		<Form
			endpoint='addRoom'
			inputs={[{
				name: 'Room name',
				id: 'name',
				type: 'text'
			}]}
			submitText='Add'
			hook={updateRooms}
			width='50%'
		/>
	{:else}
		<Collapsible title='Click here to show rooms'>
		{#each rooms as room (room._id)}
		<div class='container' animate:move in:reveal out:vanish>
			<p>{room.name}</p>
			<Form
				endpoint='delRoom'
				submitText='Delete'
				inputs={[
					{
						hidden: 'true',
						type: 'text',
						id: 'id',
						value: room._id.toString()
					}
				]}
				hook={updateRooms}
			/>
		</div>
		{/each}
		<Form
			endpoint='addRoom'
			inputs={[{
				name: 'Room name',
				id: 'name',
				type: 'text'
			}]}
			submitText='Add'
			hook={updateRooms}
			width='50%'
		/>
		</Collapsible>
	{/if}
	<div class='spacer'></div>
	<Section title='Tags' subtitle='add or remove tags for your Todo list' />
	{#if !tags.length}
		<p class='tooltip'>To organize your Todos you can use your own tag filters!</p>
		<p class='tooltip'>Later you will be able to assign a tag to every Todo in you list!</p>
		<Form
			endpoint='addTag'
			inputs={[{
				name: 'Tag:',
				id: 'tag',
				type: 'text'
			}]}
			submitText='Add'
			hook={updateTags}
			width='50%'
		/>
	{:else}
		<Collapsible title='Click here to show tags'>
		{#each tags as tag (tag)}
		<div class='container' animate:move in:reveal out:vanish>
			<p>{tag}</p>
			<Form
				endpoint='delTag'
				submitText='Delete'
				inputs={[
					{
						hidden: 'true',
						type: 'text',
						id: 'tag',
						value: tag
					}
				]}
				hook={updateTags}
			/>
		</div>
		{/each}
		<Form
			endpoint='addTag'
			inputs={[{
				name: 'Tag',
				id: 'tag',
				type: 'text'
			}]}
			submitText='Add'
			hook={updateTags}
			width='50%'
		/>
		</Collapsible>
	{/if}
	<div class='spacer'></div>
	<Section title='Profile' subtitle='do things with your account' />
	<div class='userActions'>
		<button class='retro-red userAction' on:click={() => {setCookie('user', '', -1000); document.location = document.location}}>Change User</button>
		<button class='retro-red userAction' on:click={() => (changingPassword = true)}>Change password</button>
		<button class='retro-red userAction' on:click={logOut}>Log out</button>
	</div>
	{#if changingPassword}
		<PasswordSheet onClose={() => (changingPassword = false)} />
	{/if}
	<div class='spacer'></div>
	<Section title='Register new account' />
	<p class='tooltip'>Here you can register a new account on the website</p>
	<p class='tooltip'>Please make only one account per family (or single)</p>
	<Collapsible title='Click here to register'>
		<div style='min-height: 10px;'></div>
		<Form
			submitText='Register'
			inputs={[
				{name: 'House username', type: 'text', id: 'username'},
				{name: 'House password', type: 'text', id: 'password'},
			]}
			endpoint='sessions'
		/>
	</Collapsible>
</div>
{/if}
