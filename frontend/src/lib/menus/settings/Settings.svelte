<script>
	import Form from "$lib/prompts/form.svelte";
	import Section from "$lib/header/Section.svelte";
	import { onMount } from "svelte";
	import { getUsers, getRooms } from "$lib/requests.js";
	export let user_id = '';
	let users = []
	let rooms = []
	
	async function updateUsers() {
		users = await getUsers()
	}
	
	async function updateRooms() {
		rooms = await getRooms()
	}

	onMount(async () => {
		updateUsers()
		updateRooms()
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
</style>

<div>
	<Section title='Users' />
	{#each users as user}
	<div class='container'>
		<p>{user.name}</p>
		{#if user._id == user_id}
			<Form endpoint='updateUser' submitText='Update color' inputs={{color: (user.color || '#ffffff') + '-color'}} />
		{/if}
		<Form endpoint='delUser' ask_confirm={"Warning: are you sure you want to delete the user named '" + user.name + "'? This will also delete ALL the statistics about them, this is not revertible"} submitText='Delete' hidden={{id: user._id}} hook={updateUsers} />
	</div>
	{/each}
	<Form endpoint='addUser' inputs={{name:'text', color: '#96616B-color'}} colorText='Color:' submitText='Add' hook={updateUsers} />

	<Section title='Rooms' />
	{#each rooms as room}
	<div class='container'>
		<p>{room.name}</p>
		<Form endpoint='delRoom' submitText='Delete' hidden={{id: room._id}} hook={updateRooms} />
	</div>
	{/each}
	<Form endpoint='addRoom' inputs={{name:'text'}} submitText='Add' hook={updateRooms} />
	<Section title='Log out' />
	<button class='retro-red' style='border-radius: 5px; margin-left: 15px; padding: 5px; border: none; color: #FFEAD0;' on:click={() => {document.cookie = `session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`; document.location = '/login'}}>Log out</button>
	<Section title='Add new account' />
	<Form submitText='Add new account' inputs={{'username': 'text', 'password': 'password'}} endpoint='sessions' />
	<Form endpoint='updateUser' submitText='Add' />
	<!-- <Section title='Danger zone' />
	<div style='background-color: transparent;'>
		<div style='justify-content: flex-start;'>
			<Form submitText='Advance all chores by 1 day' endpoint='dbgChores' />
			<Form submitText='Reset chores stats' endpoint='clearStats' />
		</div>
	</div> -->
</div>
