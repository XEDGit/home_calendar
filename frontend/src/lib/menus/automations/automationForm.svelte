<script>
	// Add and edit share this form. onSubmit gets the fields and returns an
	// error message to show, or null when saved.
	export let initial = {};
	export let submitText = 'Save';
	export let onSubmit = async () => null;
	export let onCancel = null;

	let name = initial.name ?? '';
	let prompt = initial.prompt ?? '';
	let every = initial.schedule?.every ?? 1;
	let unit = initial.schedule?.unit ?? 'days';
	// Editing an existing schedule with no `at` (e.g. a minutes/hours automation,
	// or a days one that was cleared) must keep showing "no time", not silently
	// default to 08:00; only a brand-new automation defaults to it.
	let at = initial.schedule ? (initial.schedule.at ?? '') : '08:00';
	let enabled = initial.enabled ?? true;
	let error = '';
	let saving = false;

	$: tooOften = (unit === 'minutes' && every < 15);

	async function submit(event) {
		event.preventDefault();
		if (tooOften) return;
		saving = true;
		error = (await onSubmit({ name, prompt, every: Number(every), unit, at: unit === 'days' ? at : '', enabled })) || '';
		saving = false;
	}
</script>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		color: var(--primary);
		width: 100%;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: var(--weight-bold);
	}

	input, select, textarea {
		font: inherit;
		color: var(--primary);
		background: var(--paper);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		padding: var(--space-xs) var(--space-sm);
	}

	textarea {
		min-height: 7em;
		resize: vertical;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		align-items: flex-end;
	}

	.row input[type='number'] {
		width: 5em;
	}

	.check {
		flex-direction: row;
		align-items: center;
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
	}

	button {
		font: inherit;
		font-weight: var(--weight-bold);
		cursor: pointer;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		padding: var(--space-xs) var(--space-md);
		background: var(--primary);
		color: var(--paper);
		transition: var(--swap);
	}

	button.secondary {
		background: var(--paper);
		color: var(--primary);
	}

	.error {
		margin: 0;
	}
</style>

<form on:submit={submit}>
	<label>Name
		<input bind:value={name} maxlength="60" required placeholder="Morning news" />
	</label>
	<label>What should the assistant do?
		<textarea bind:value={prompt} maxlength="2000" required
			placeholder="Search the news about Rome and give me the three most important stories"></textarea>
	</label>
	<div class="row">
		<label>Every
			<input type="number" min="1" bind:value={every} required />
		</label>
		<label>Unit
			<select bind:value={unit}>
				<option value="minutes">minutes</option>
				<option value="hours">hours</option>
				<option value="days">days</option>
			</select>
		</label>
		{#if unit === 'days'}
			<label>At (optional)
				<input type="time" bind:value={at} />
			</label>
		{/if}
	</div>
	<label class="check"><input type="checkbox" bind:checked={enabled} /> Enabled</label>
	{#if tooOften}<p class="error" role="alert">Automations can run at most every 15 minutes.</p>{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
	<div class="actions">
		<button type="submit" disabled={saving || tooOften}>{saving ? 'Saving…' : submitText}</button>
		{#if onCancel}<button type="button" class="secondary" on:click={onCancel}>Cancel</button>{/if}
	</div>
</form>
