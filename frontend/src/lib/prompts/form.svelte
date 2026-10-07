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
		box-sizing: border-box;
		max-width: calc(100% - var(--space-md));
		margin-left: var(--space-md);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		padding: var(--space-xs);
		display: inline-block;
		font-size: var(--text-lg);
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
		min-width: 0;
		background: none;
		border: none;
		border-bottom: var(--bw) solid var(--primary);
		caret-color: var(--primary);
		color: var(--primary);
	}

	input:focus {
		border-bottom-color: var(--primary-deep);
	}

	textarea {
		box-sizing: border-box;
		width: 100%;
		max-width: 100%;
		height: 6em;
		max-height: 50%;
		overflow-x: hidden;
		border: var(--bw) solid var(--primary);
		text-wrap: wrap;
		word-wrap: break-word;
		background-color: var(--paper);
		color: var(--primary);
		border-radius: var(--radius-md);
		resize: none;
	}

	select {
        padding: var(--space-xs);
        border-radius: var(--radius-md);
        border: var(--bw) solid var(--primary);
        background-color: var(--paper);
        color: var(--primary);
    }

    option {
        background-color: var(--paper);
        color: var(--primary);
    }

	input[type="checkbox"] {
		width: 24px;
		height: 24px;
		margin-right: 10px;
		background-color: var(--paper);
		border: var(--bw) solid var(--primary);
	}

	input[type="checkbox"]:checked {
		background-color: var(--primary);
	}

	label {
		flex: 1;
		color: var(--primary);
		margin-right: 10px;
		display: flex;
		gap: 20px;
		justify-content: space-between;
	}

	button {
		background-color: var(--primary);
		color: var(--paper);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		padding: var(--control-pad-y) var(--control-pad-x);
		min-height: var(--control-min-h);
		font-weight: var(--weight-bold);
		font-family: inherit;
		cursor: pointer;
		transition: var(--swap);
	}

	@media (hover: hover) {
		button:hover {
			background-color: var(--paper);
			color: var(--primary);
		}
	}

	.fade {
		opacity: 0;
		transition: opacity var(--dur-base) var(--ease-out);
		pointer-events: none;
		color: var(--primary);
		font-weight: var(--weight-bold);
		margin: 7px 0;
		font-size: var(--text-sm);
		width: 0;
	}

	.fade.show {
		opacity: 1;
		margin-left: 5px;
		margin-right: 40px;
	}

	/* Phones: each label sits above its field and the field takes the full
	 * width, instead of a big label squeezing a tiny field beside it */
	@media (max-width: 480px) {
		.main-container {
			display: block;
			font-size: var(--text-base);
		}

		/* Forms with fields take the full width; a lone button (Delete) doesn't */
		.main-container:not(.compact) {
			width: 100%;
		}

		.single {
			align-items: flex-end;
		}

		label {
			min-width: 0;
			margin-right: 0;
			flex-direction: column;
			align-items: stretch;
			gap: 4px;
			font-weight: var(--weight-bold);
		}

		label.inline {
			flex-direction: row;
			align-items: center;
		}

		.fade.show {
			margin-right: var(--space-sm);
		}
	}

</style>

<div class='main-container' class:compact={!inputs.some((d) => d.type != 'hidden' && !d.hidden)} style="min-width: {width || ''};">
	<form on:submit|preventDefault={handleSubmit} class={Object.keys(inputs).length > 1? 'multi' : 'single'}>
		{#each inputs as data}
			{#if data.type == 'color'}
				<label for={data.id} style='margin-right: 0'><span>{data.name}</span>
					<ColorPicker --picker-indicator-size="25px" bind:hex={formData[data.id]} label="" position='responsive' />
				</label>
			{:else if data.type == 'checkbox'}
				<label class="inline" for={data.id}>{data.name}
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
			<p class="fade {done ? 'show' : ''}" role="status">{done ? '✓ Done!' : ''}</p>
			<button style='white-space: nowrap;' type="submit">{submitText}</button>
		</div>
	</form>
</div>
