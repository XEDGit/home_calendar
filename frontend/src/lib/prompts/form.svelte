<script>
	import ColorPicker from 'svelte-awesome-color-picker';

	export let endpoint = ''
	export let inputs = [];
	export let hook = null;
	export let width = null;
	export let submitText = 'Submit'
	export let ask_confirm = '';

	let formData = {};
	let done = false;

	// Initialize formData with empty values for each input field
	for (const data of inputs) {
		if (data.type == 'date' && data['value'] == null) {
			formData[data.id] = `${(new Date()).getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, 0)}-${String(new Date().getDate()).padStart(2, 0)}`
		}
		else {
			formData[data.id] = data['value'] || '';
		}
	}

	function resetForm() {
		for (const key in formData) {
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
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				const result = await response.json();
				done = true;
				setTimeout(() => {done = false;}, 1500);
				if (hook)
					await hook();
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
		font-size: 1.4em;
	}
	.multi {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.single {
		width: 100%;
		display: inline-flex;
		flex-direction: row;
		gap: 10px;
		justify-content: space-between;
	}

	input {
		outline: none;
		background: none;
		border: none;
		border-radius: 4px;
		border-bottom: 1px solid #96616B;
		caret-color: #96616B80;
		color: #96616B;
	}

	textarea {
		width: 100%;
		max-width: 100%;
		height: 6em;
		max-height: 50%;
		overflow-x: hidden;
		border: solid 1px #96616B;
		text-wrap: wrap;
		word-wrap: break-word;
		background-color: #FFEAD0;
		color: #96616B;
		border-radius: 5px;
		resize: none;
		outline: none;
	}

	select {
        padding: 5px;
        border-radius: 4px;
        border: 1px solid #96616B;
        background-color: #FFEAD0;
        color: #96616B;
    }

    option {
        background-color: #FFEAD0;
        color: #96616B;
    }
	
	input[type="checkbox"] {
		width: 20px;
		height: 20px;
		margin-right: 10px;
		background-color: #FFEAD0;
		border: 2px solid #96616B;
	}

	input[type="checkbox"]:checked {
		background-color: #96616B;
	}

	label {
		flex: 1;
		color: #96616B;
		margin-right: 10px;
		display: flex;
		gap: 20px;
		justify-content: space-between;
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

<div class='main-container' style="min-width: {width || ''};">
	<form on:submit|preventDefault={handleSubmit} class={Object.keys(inputs).length > 1? 'multi' : 'single'}>
		{#each inputs as data}
			{#if data.type == 'color'}
				<label for={data.id} style='margin-right: 0'><span>{data.name}</span>
					<ColorPicker --picker-indicator-size="25px" bind:hex={formData[data.id]} label="" position='responsive' />
				</label>
			{:else if data.type == 'checkbox'}
				<label for={data.id}>{data.name}
					<input
						id={data.id}
						type='checkbox'
						bind:checked={formData[data.id]}
						required={data.required || false}
						placeholder={data.placeholder || ''}
						hidden={data.hidden || false}
						/>
				</label>
			{:else if data.type == 'select'}
				{#if !data.hidden}
				<label for={data.id}><span>{data.name}</span>
					<select
						name={data.name}
						id={data.id}
						bind:value={formData[data.id]}
						required={data.required || false}
					>
						{#each data.options as option}
							<option value={option.value || option.name}>{option.name}</option>
						{/each}
					</select>
					
				</label>
				{/if}
			{:else if data.type == 'textarea'}
				<label for={data.id}><span>{data.name}</span>
					<textarea
						id={data.id}
						type={data.type}
						bind:value={formData[data.id]}
						required={data.required || false}
						placeholder={data.placeholder || ''}
						hidden={data.hidden || false}
					></textarea>
				</label>
			{:else}
				<label for={data.id}><span>{data.name}</span>
					<input
						id={data.id}
						type={data.type}
						bind:value={formData[data.id]}
						required={data.required || false}
						placeholder={data.placeholder || ''}
						hidden={data.hidden || false}
					/>
				</label>
			{/if}
		{/each}
		<slot/>
		<div style='display: inline-flex; flex-direction: row;'>
			<p class="fade {done ? 'show' : ''}">Done!</p>
			<button style='white-space: nowrap;' type="submit">{submitText}</button>
		</div>
	</form>
</div>
