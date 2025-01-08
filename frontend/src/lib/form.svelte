<script>
	export let endpoint = ''
	export let inputs = {};
	export let hidden = {};
	export let submitText = 'Submit'
	export let hook = null;
	let formData = {};
	let done = false;

	// Initialize formData with empty values for each input field
	$: {
		for (const key in inputs) {
			if (!(key in formData)) {
				formData[key] = '';
			}
		}
	}

	function resetForm() {
		for (const key in inputs) {
			formData[key] = '';
		}
	}

	async function handleSubmit(event) {
		event.preventDefault();

		try {
		const response = await fetch('/api/' + endpoint, {
			method: 'POST',
			headers: {
			'Content-Type': 'application/json',
			},
			body: JSON.stringify({...formData, ...hidden}),
		});

		if (response.ok) {
			const result = await response.json();
			done = true;
			setTimeout(() => {done = false;}, 1500);
			if (hook)
				hook();
			resetForm();
		} else {
			console.error('Error:', response.statusText);
		}
		} catch (error) {
		console.error('Error:', error);
		}
	}
</script>

<style>
	.main-container {
		margin-left: 15px;
		border: 3px solid #96616B;
		border-radius: 7px;
		padding: 5px;
		display: inline-block;
	}
	.multi {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	input {
		outline: none;
		background: none;
		border: none;
		width: 20vw;
		border-radius: 4px;
		border-bottom: 1px solid #96616B;
		caret-color: #96616B80;
		color: #96616B;
	}
	
	label {
		flex: 1;
		color: #96616B;
		margin-right: 10px;
	}

	button {
		background-color: #96616B;
		color: #FFEAD0;
		border: none;
		border-radius: 7px;
		padding: 0.5em 1em;
	}

	button:hover {
		background-color: #FFEAD0;
		color: #96616B;
	}

	.fade {
		opacity: 0;
		pointer-events: none;
		color: #15f60180;
		margin: 7px 0;
		font-size: 14px;
		width: 0;
	}

	.fade.show {
		opacity: 1;
		margin-left: 5px;
		margin-right: 40px;
	}

</style>

<div class='main-container'>
	<form on:submit|preventDefault={handleSubmit} class={Object.keys(inputs).length > 1? 'multi' : ''}>
		{#each Object.entries(inputs) as [name, type]}
			<label for={name}>{name.charAt(0).toUpperCase() + name.slice(1)}
			<input
				id={name}
				type={type}
				bind:value={formData[name]}
				required
			/>
			</label>
		{/each}

		{#each Object.entries(hidden) as [name, value]}
			<input
				id={name}
				type='hidden'
				value={value}
				required
			/>
		{/each}

		<div style='display: inline-flex; flex-direction: row;'>
			<p class="fade {done ? 'show' : ''}">Done!</p>
			<button type="submit">{submitText}</button>
		</div>
	</form>
</div>
