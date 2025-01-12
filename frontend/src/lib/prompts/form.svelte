<script>
    import { color } from 'chart.js/helpers';
	import ColorPicker from 'svelte-awesome-color-picker';

	export let endpoint = ''
	export let inputs = {};
	export let hidden = {};
	export let submitText = 'Submit'
	export let hook = null;
	export let ask_confirm = '';
	export let colorText = '';

	let formData = {};
	let done = false;

	// Initialize formData with empty values for each input field
	$: {
		for (const key in inputs) {
			if (key.endsWith('color') && !(key in formData)) {
				formData['color'] = inputs[key].split('-')[0];
			}
			else if (!(key in formData)) {
				formData[key] = '';
			}
		}
	}

	function resetForm() {
		for (const key in inputs) {
			if (key == 'color') continue;
			formData[key] = '';
		}
	}

	async function handleSubmit(event) {
		event.preventDefault();
		if (ask_confirm != '') {
			if (!confirm(ask_confirm))
				return
		}

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
	.single {
		display: inline-flex;
		flex-direction: row;
		gap: 10px;
		justify-content: center;
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
		padding: 1vw 2vw;
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
	<form on:submit|preventDefault={handleSubmit} class={Object.keys(inputs).length > 1? 'multi' : 'single'}>
		{#each Object.entries(inputs) as [name, type]}
			{#if type.endsWith('color')}
				<label for={name} style='margin-right: 0'>{colorText}
				<ColorPicker --picker-indicator-size="25px" bind:hex={formData['color']} label="" position='responsive' />
				</label>
			{:else}
				<label for={name}>{name.charAt(0).toUpperCase() + name.slice(1)}
				<input
					id={name}
					type={type}
					bind:value={formData[name]}
					required
				/>
				</label>
			{/if}
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
			<button style='white-space: nowrap;' type="submit">{submitText}</button>
		</div>
	</form>
</div>
