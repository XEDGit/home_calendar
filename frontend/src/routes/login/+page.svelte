<script>
	import { redirect } from '@sveltejs/kit'
	let password = '';
	let username = '';

	let busy = false
	async function login() {
		if (busy)
			return
		busy = true
		const res = await fetch('api/login', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({'password': password, 'username': username}, null, 2),
		});
		if (res.status == 200) {
			window.location.href = '/';
		}
		busy = false
	}
</script>

<div class='info-card'>
	<form on:submit|preventDefault={login}>
	<input
		type="text"
		bind:value={username}
		placeholder="Username"
	/>
	<input
		type="password"
		bind:value={password}
		placeholder="Password"
	/>
	<button type="submit">Login</button>
	</form>
</div>
