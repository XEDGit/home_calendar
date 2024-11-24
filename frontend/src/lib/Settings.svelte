<script>
	import Form from "./form.svelte";
	import Section from "./Section.svelte";

	let users = [] 
	function getUsers() {
		fetch('api/getUsers', {
			method: 'GET',
		}).then(res => 
			res.json().then(json => {
				users = json;
			})
		)
	}
	getUsers()

	let rooms = [] 
	function getRooms() {
		fetch('api/getRooms', {
			method: 'GET',
		}).then(res => 
			res.json().then(json => {
				rooms = json;
			})
		)
	}
	getRooms()
</script>

<style>
	div {
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

<Section title='Users' />
{#each users as user}
<div>
	<p>{user.name}</p>
	<Form endpoint='delUser' submitText='Delete' hidden={{id: user._id}} hook={getUsers} />
</div>
{/each}
<Form endpoint='addUser' inputs={{name:'text'}} submitText='Add' hook={getUsers} />

<Section title='Rooms' />
{#each rooms as room}
<div>
	<p>{room.name}</p>
	<Form endpoint='delRoom' submitText='Delete' hidden={{id: room._id}} hook={getRooms} />
</div>
{/each}
<Form endpoint='addRoom' inputs={{name:'text'}} submitText='Add' hook={getRooms} />