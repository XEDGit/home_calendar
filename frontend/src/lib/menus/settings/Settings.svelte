<script>
	import Form from "$lib/prompts/form.svelte";
	import Section from "$lib/header/Section.svelte";
	import { onMount } from "svelte";
	import { getUsers, getRooms, getTags, postFrontend } from "$lib/requests.js";
    import ColorPicker from "svelte-awesome-color-picker";
    import Collapsible from "$lib/containers/collapsible.svelte";
	import { setCookie } from "$lib/helpers/getCookie";

	export let user_id = '';
	let users = []
	let rooms = []
	let tags = []
	let own_color = 'red';

	async function updateUsers() {
		users = await getUsers()
		own_color = users.find((u) => u._id == user_id)?.color
	}

	async function updateRooms() {
		rooms = await getRooms()
	}

	async function updateTags() {
		tags = await getTags()
	}

	onMount(async () => {
		updateRooms()
		updateUsers()
		updateTags()
	})
</script>

<style>
	.container {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		margin: 15px 15px;
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

	.userAction {
		border-radius: 5px;
		margin-left: 15px;
		padding: 5px;
		border: none;
		color: #FFEAD0;
		border: 3px solid #96616B;
	}

	.userAction:hover {
		background-color: #FFEAD0;
		color: #96616B;
	}

	.spacer {
		height: 20px;
	}
</style>

<div>
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
		{#each rooms as room}
		<div class='container'>
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
		{#each tags as tag}
		<div class='container'>
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
	<button class='retro-red userAction' on:click={() => {setCookie('user', '', -1000); document.location = document.location}}>Change User</button>
	<button class='retro-red userAction' on:click={() => {setCookie('user', '', -1000); setCookie('session', '', -1000); document.location = '/login'}}>Log out</button>
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
