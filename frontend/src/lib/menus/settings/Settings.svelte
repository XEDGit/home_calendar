<script>
	import Form from "$lib/prompts/form.svelte";
	import Section from "$lib/header/Section.svelte";
	import { getContext, onMount } from "svelte";
	import { getUsers, getRooms, postFrontend } from "$lib/requests.js";
    import ColorPicker from "svelte-awesome-color-picker";
    import Collapsible from "$lib/containers/collapsible.svelte";
	import { setCookie } from "$lib/helpers/getCookie";

	export let user_id = '';
	let users = []
	let rooms = []
	let own_color = 'red';

	async function updateUsers() {
		users = await getUsers()
		own_color = users.find((u) => u._id == user_id)?.color
	}

	async function updateRooms() {
		rooms = await getRooms()
	}

	onMount(async () => {
		updateRooms()
		updateUsers()
	})
</script>

<style>
	.container {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		margin: 0 15px;
		margin-bottom: 15px;
		background-color: #96616B;
		width: 50%;
		min-width: 80vw;
		border-radius: 7px;
		padding: 2px 10px;
	}

	p {
		color: #FFEAD0;
		align-content: center;
		margin: 0;
	}

	.tooltip {
		color: gray;
		font-style: italic;
		margin-bottom: 20px;
	}
</style>

<div>
	<Section title='Users' />
	{#each users as user}
	<div class='container'>
		{#if user._id == user_id}
		<div style='display: flex; gap: 10px; align-items: center;'>
			<p>{user.name}</p>
			<ColorPicker label='' bind:hex={own_color} on:input={(e) => {postFrontend('updateUser', {color: e.detail.hex});}} ></ColorPicker>
		</div>
		{:else}
			<p>{user.name}</p>
		{/if}
		<Form endpoint='delUser' ask_confirm={"Warning: are you sure you want to delete the user named '" + user.name + "'? This will also delete ALL the statistics about them, this is not revertible"} submitText='Delete' hidden={{id: user._id}} hook={updateUsers} />
	</div>
	{/each}
	{#if !users.length}
		<p class='tooltip'>I don't know who you are!</p>
		<p class='tooltip'>Please add your name here</p>
	{/if}
	<Form endpoint='addUser' inputs={{'person name:':'text', color: '#' + Math.round(Math.random() * 0xffffff).toString(16).padEnd(6, 0) + '-color'}} colorText='Color:' submitText='Add' hook={() => {if (!users?.length) document.location = '/settings'; updateUsers()}} />

	<Section title='Rooms' subtitle='add or remove rooms from your household' />
	{#each rooms as room}
	<div class='container'>
		<p>{room.name}</p>
		<Form endpoint='delRoom' submitText='Delete' hidden={{id: room._id}} hook={updateRooms} />
	</div>
	{/each}
	{#if !rooms.length}
		<p class='tooltip'>You have rooms in your home? Then add their names in here!</p>
		<p class='tooltip'>Later you will be able to assign tasks to specific rooms</p>
	{/if}
	<Form endpoint='addRoom' inputs={{'room name:':'text'}} submitText='Add' hook={updateRooms} />
	<Section title='Profile' subtitle='do things with your account' />
	<button class='retro-red' style='border-radius: 5px; margin-left: 15px; padding: 5px; border: none; color: #FFEAD0;' on:click={() => {setCookie('user', '', -1000)}}>Change User</button>
	<button class='retro-red' style='border-radius: 5px; margin-left: 15px; padding: 5px; border: none; color: #FFEAD0;' on:click={() => {setCookie('user', '', -1000); setCookie('session', '', -1000); document.location = '/login'}}>Log out</button>
	<Section title='Register new account' />
	<p class='tooltip'>Here you can register a new account on the website</p>
	<p class='tooltip'>Please make only one account per family (or single)</p>
	<Collapsible title='Click here to register'>
		<div style='min-height: 10px;'></div>
		<Form submitText='Register' inputs={{'username': 'text', 'password': 'password'}} endpoint='sessions' />
	</Collapsible>
</div>
