<script>
    import { postFrontend } from '$lib/requests';
	import { redirect } from '@sveltejs/kit'
	let password = '';
	let username = '';

	let busy = false
	let error = ''
	async function login() {
		if (busy)
			return
		busy = true
		error = ''
		try {
			const res = await postFrontend('login', {'password': password, 'username': username})
			if (!res['error']) {
				window.location.href = '/';
				return
			}
			error = res['error']
		} catch {
			error = 'Could not reach the server'
		}
		busy = false
	}
</script>

<style>
	.login-wrap {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: var(--paper);
		font-family: var(--font-sans);
	}

	.login-card {
		background-color: var(--paper);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-lg);
		padding: var(--space-lg);
		/* Border-box, so the 90vw includes the padding and a phone keeps a margin */
		box-sizing: border-box;
		width: min(90vw, 340px);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	h1 {
		color: var(--primary);
		margin: 0;
		font-size: var(--text-lg);
		text-align: center;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	input {
		background: none;
		border: none;
		border-bottom: var(--bw) solid var(--primary);
		caret-color: var(--primary);
		color: var(--primary);
		font-size: var(--text-base);
		padding: var(--space-xs) 2px;
		font-family: inherit;
	}

	input::placeholder {
		color: var(--primary);
		font-style: italic;
	}

	.error {
		color: var(--primary-deep);
		margin: 0;
		font-size: var(--text-sm);
		text-align: center;
	}

	input:focus {
		border-bottom-color: var(--primary-deep);
	}
</style>

<div class='login-wrap'>
	<div class='login-card'>
		<h1>Home Calendar</h1>
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
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}
		<button class="btn btn-solid btn-block" type="submit" disabled={busy}>Login</button>
		</form>
	</div>
</div>
