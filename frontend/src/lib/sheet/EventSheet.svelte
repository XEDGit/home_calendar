<script>
	// One event: see it, edit it in place, or add a new one. A repeat (one
	// occurrence of a series) shows its own day, and editing it edits the
	// series: the date field then holds when the series starts.
	import { onMount, tick } from 'svelte';
	import { closeDialog, morphHeight } from '$lib/motion';
	import { postFrontend } from '$lib/requests';
	import Sheet from './Sheet.svelte';
	import Icon from './Icon.svelte';
	import { REPEATS, repeatKey, repeatText, localParts, joinLocal, dateInput, formatWhen, formatDay } from './when.js';

	export let event = null;       // the event or repeat to show; null adds one
	export let start = null;       // adding: when the new event starts
	export let onSaved = () => {}; // (event) after an add or an edit
	export let onDeleted = () => {};
	export let onClose = () => {};

	const uid = Math.random().toString(36).slice(2, 8);
	let dialog, titleInput, editButton;
	let shown = event;
	let mode = event ? 'view' : 'add';
	let draft = event ? fromEvent(event) : blank();
	let saving = false;
	let error = '';
	let titleError = '';
	let sure = false;
	let sureTimer;

	$: seriesId = shown?.originalEventId || shown?._id;
	$: repeating = Number(shown?.repeatDays) > 0;
	$: seriesStart = isRepeat(shown) ? shown.originalEventDate : shown?.when;
	$: since = repeating && dateInput(seriesStart) !== dateInput(shown?.when) ? formatDay(seriesStart) : '';
	// A repeat the choices don't cover (every 14 days) stays one of them
	$: choices = repeatKey(shown?.repeatDays) === 'custom'
		? [...REPEATS, { key: 'custom', label: repeatText(shown.repeatDays) }]
		: REPEATS;
	$: kind = mode === 'add' ? 'New event' : mode === 'edit' ? 'Edit event' : 'Event';

	// One occurrence of a series, as the server generates them
	function isRepeat(e) {
		return !!e?.isOccurrence && Number(e.repeatDays) > 0;
	}

	function blank() {
		const p = localParts(start || new Date());
		return { title: '', date: p.date, time: p.time, repeat: 'never', location: '', description: '' };
	}

	function fromEvent(e) {
		const p = localParts(isRepeat(e) ? e.originalEventDate : e.when);
		return { title: e.title || '', date: p.date, time: p.time, repeat: repeatKey(e.repeatDays), location: e.location || '', description: e.description || '' };
	}

	onMount(() => { if (mode === 'add') titleInput?.focus(); });

	async function setMode(next) {
		const settle = morphHeight(dialog);
		if (next === 'edit') draft = fromEvent(shown);
		mode = next;
		error = titleError = '';
		sure = false;
		await tick();
		settle();
		// Focus follows the change: the first field, or back on Edit
		(next === 'view' ? editButton : titleInput)?.focus();
	}

	function submitOnModEnter(e) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
	}

	async function save() {
		if (saving) return;
		titleError = draft.title.trim() ? '' : 'Give it a title';
		if (titleError) { titleInput?.focus(); return; }
		if (!draft.date) { error = 'Pick a day'; return; }
		saving = true;
		error = '';
		const fields = {
			title: draft.title.trim(),
			when: joinLocal(draft.date, draft.time),
			location: draft.location.trim(),
			description: draft.description.trim(),
		};
		try {
			if (mode === 'add') {
				const r = await postFrontend('addEvent', { ...fields, repeatInterval: draft.repeat === 'never' ? '' : draft.repeat });
				if (!(r?.success || r?.insertedId)) throw new Error(r?.error || r?.message);
				onSaved({ ...fields, _id: r.insertedId, repeatDays: REPEATS.find(x => x.key === draft.repeat).days });
				closeDialog(dialog);
				return;
			}
			const startBefore = fromEvent(shown).date;
			const repetition = draft.repeat === 'custom' ? {} : { repetition: draft.repeat === 'never' ? 'none' : draft.repeat };
			const r = await postFrontend('updateEvent', { _id: seriesId, ...fields, ...repetition });
			if (!r?.success) throw new Error(r?.message);
			const saved = r.event || { ...shown, ...fields, _id: seriesId };
			// Keep showing the repeat that was opened, at its new time, unless
			// the series moved or stopped repeating
			shown = isRepeat(shown) && Number(saved.repeatDays) > 0 && draft.date === startBefore
				? { ...saved, when: joinLocal(dateInput(shown.when), draft.time), isOccurrence: true, originalEventId: seriesId, originalEventDate: saved.when }
				: saved;
			onSaved(saved);
			await setMode('view');
		} catch (err) {
			error = err?.message ? `Couldn't save: ${err.message}` : "Couldn't save. Try again.";
		} finally {
			saving = false;
		}
	}

	async function remove() {
		if (!sure) {
			sure = true;
			clearTimeout(sureTimer);
			sureTimer = setTimeout(() => (sure = false), 4000);
			return;
		}
		clearTimeout(sureTimer);
		saving = true;
		error = '';
		try {
			const r = await postFrontend('deleteEvent', { id: seriesId });
			if (!r?.success) throw new Error(r?.message);
			onDeleted(seriesId);
			closeDialog(dialog);
		} catch (err) {
			error = err?.message ? `Couldn't delete: ${err.message}` : "Couldn't delete. Try again.";
			sure = false;
		} finally {
			saving = false;
		}
	}
</script>

<Sheet {kind} label={mode === 'view' ? shown.title : kind} lockBackdrop={mode !== 'view'} {onClose} bind:dialog>
	{#if mode === 'view'}
		<h2 class="entry-title">{shown.title}</h2>
		<ul class="facts">
			<li><Icon name="clock" /><span><span class="sr-only">When: </span>{formatWhen(shown.when)}</span></li>
			{#if repeating}
				<li><Icon name="repeat" /><span>{repeatText(shown.repeatDays)}{#if since}<span class="quiet">{`, since ${since}`}</span>{/if}</span></li>
			{/if}
			{#if shown.location}
				<li><Icon name="pin" /><span><span class="sr-only">Where: </span>{shown.location}</span></li>
			{/if}
		</ul>
		{#if shown.description}
			<p class="notes prose">{shown.description}</p>
		{/if}
	{:else}
		<form class="fields" id="event-form-{uid}" on:submit|preventDefault={save} novalidate>
			<div class="field">
				<label class="label" for="event-title-{uid}">Title</label>
				<input class="line big" id="event-title-{uid}" bind:this={titleInput} bind:value={draft.title} maxlength="200"
					placeholder="Dentist, football practice…" aria-invalid={titleError ? 'true' : undefined}
					aria-describedby={titleError ? `event-title-error-${uid}` : undefined} />
				{#if titleError}<span class="field-error" id="event-title-error-{uid}">{titleError}</span>{/if}
			</div>

			<div class="field">
				<span class="label" id="event-when-{uid}">{draft.repeat === 'never' ? 'When' : 'Starts'}</span>
				<div class="row">
					<input class="input" type="date" bind:value={draft.date} aria-labelledby="event-when-{uid}" required />
					<input class="input" type="time" step="60" bind:value={draft.time} aria-label="Time" />
				</div>
			</div>

			<fieldset class="field">
				<legend class="label">Repeat</legend>
				<div class="choices">
					{#each choices as c}
						<label class="choice"><input type="radio" name="event-repeat-{uid}" value={c.key} bind:group={draft.repeat} /><span>{c.label}</span></label>
					{/each}
				</div>
				{#if mode === 'edit' && repeating}<span class="hint">Changes apply to every repeat.</span>{/if}
			</fieldset>

			<label class="field">
				<span class="label">Where</span>
				<input class="line" bind:value={draft.location} maxlength="200" placeholder="Optional" />
			</label>

			<label class="field">
				<span class="label">Notes</span>
				<textarea class="input" rows="3" bind:value={draft.description} on:keydown={submitOnModEnter} placeholder="Optional"></textarea>
			</label>
		</form>
	{/if}

	<svelte:fragment slot="footer">
		{#if error}<p class="foot-error" role="alert">{error}</p>{/if}
		{#if mode !== 'add'}
			<button type="button" class="delete" class:sure on:click={remove} disabled={saving}>
				{sure ? (repeating ? 'Delete every repeat?' : 'Delete for good?') : 'Delete'}
			</button>
		{/if}
		<span class="spacer"></span>
		{#if mode === 'view'}
			<button type="button" class="btn btn-solid" bind:this={editButton} on:click={() => setMode('edit')}>Edit</button>
		{:else}
			<button type="button" class="btn btn-ghost" on:click={() => (mode === 'add' ? closeDialog(dialog) : setMode('view'))} disabled={saving}>Cancel</button>
			<button type="submit" class="btn btn-solid" form="event-form-{uid}" disabled={saving}>
				{saving ? 'Saving…' : mode === 'add' ? 'Add event' : 'Save'}
			</button>
		{/if}
	</svelte:fragment>
</Sheet>
