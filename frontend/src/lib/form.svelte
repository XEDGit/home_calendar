<script>
	export let endpoint = ''
	export let inputs = {};
	export let hidden = {};
	export let submitText = 'Submit'
	export let hook = null;
	let formData = {};

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
			console.log('Success:', result);
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
	input {
		background: none;
		border: none;
		border-radius: 4px;
		border-bottom: 1px solid #96616B;
	}

	label {
		color: #96616B;
	}

	button {
		background-color: #96616B;
		color: #FFEAD0;
		border: none;
		border-radius: 15px;
		padding: 0 1em;
	}
</style>

<form on:submit|preventDefault={handleSubmit}>
{#each Object.entries(inputs) as [name, type]}
	<label for={name}>{name.charAt(0).toUpperCase() + name.slice(1)}:</label>
	<input
		id={name}
		type={type}
		bind:value={formData[name]}
		required
	/>
{/each}

{#each Object.entries(hidden) as [name, value]}
	<input
		id={name}
		type='hidden'
		value={value}
		required
	/>
{/each}

<button type="submit">{submitText}</button>
</form>
