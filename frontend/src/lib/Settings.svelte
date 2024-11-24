<script>
	import Form from "./form.svelte";

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
		border-radius: 7px;
		padding: 2px 10px;
	}

	p {
		color: #FFEAD0;
		margin: 0;
	}
</style>

<h2>Users</h2>
<hr />
{#each users as user}
<div>
	<p>{user.name}</p>
	<Form endpoint='delUser' submitText='Delete' hidden={{id: user._id}} hook={getUsers} />
</div>
{/each}
<Form endpoint='addUser' inputs={{name:'text'}} submitText='Add' hook={getUsers} />