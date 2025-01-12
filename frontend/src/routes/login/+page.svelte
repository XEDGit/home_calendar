<script>
    import { postFrontend } from '$lib/requests';
	import { redirect } from '@sveltejs/kit'
	let password = '';
	let username = '';

	let busy = false
	async function login() {
		if (busy)
			return
		busy = true
		const res = await postFrontend('login', {'password': password, 'username': username})
		if (!res['error']) {
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
