<script>
	// One todo: see it, mark it done, edit it in place, or add a new one.
	// Only the member who added a todo edits or deletes it; anyone who sees
	// it can mark it done, as on the board.
	import { onMount, tick } from 'svelte';
	import { closeDialog, morphHeight } from '$lib/motion';
	import { addTodo, updateTodo, deleteTodo, getTags } from '$lib/requests';
	import { getCookie } from '$lib/helpers/getCookie';
	import Sheet from './Sheet.svelte';
	import Icon from './Icon.svelte';
	import { deadlineInfo, dateInput, QUICK_DEADLINES } from './when.js';

	export let todo = null;        // null adds one
	export let onSaved = () => {}; // (todo) after an add, an edit or a done toggle
	export let onDeleted = () => {};
	export let onClose = () => {};

	const PRIORITIES = [
		{ value: 0, label: 'None', color: 'var(--idle)' },
		{ value: 1, label: 'Low', color: 'var(--ok)' },
		{ value: 2, label: 'Medium', color: 'var(--warn)' },
		{ value: 3, label: 'High', color: 'var(--urgent)' },
	];

	const uid = Math.random().toString(36).slice(2, 8);
	let dialog, titleInput, editButton;
	let shown = todo;
	let mode = todo ? 'view' : 'add';
	let draft = todo ? fromTodo(todo) : blank();
	let tags = [];
	let me = '';
	let saving = false;
	let error = '';
	let titleError = '';
	let sure = false;
	let sureTimer;

	$: canEdit = !shown || String(shown.user) === String(me);
	$: deadline = deadlineInfo(shown?.deadline);
	$: priority = PRIORITIES.find(p => p.value === Number(shown?.priority)) ?? PRIORITIES[0];
	$: kind = mode === 'add' ? 'New todo' : mode === 'edit' ? 'Edit todo' : 'Todo';
	// A tag that was removed from the list still shows on its todo
	$: tagChoices = draft.tag && !tags.includes(draft.tag) ? [...tags, draft.tag] : tags;

	function blank() {
		return { title: '', description: '', deadline: '', priority: 0, tag: '', shared: false };
	}

	function fromTodo(t) {
		return {
			title: t.title || '',
			description: t.description || '',
			deadline: dateInput(t.deadline),
			priority: Number(t.priority) || 0,
			tag: t.tag || '',
			shared: !!t.shared,
		};
	}

	onMount(async () => {
		me = getCookie('user');
		if (mode === 'add') titleInput?.focus();
		const list = await getTags().catch(() => []);
		tags = Array.isArray(list) ? list : [];
	});

	async function setMode(next) {
		const settle = morphHeight(dialog);
		if (next === 'edit') draft = fromTodo(shown);
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

	const fail = (what, err) => (err?.message ? `Couldn't ${what}: ${err.message}` : `Couldn't ${what}. Try again.`);

	async function save() {
		if (saving) return;
		titleError = draft.title.trim() ? '' : 'Give it a title';
		if (titleError) { titleInput?.focus(); return; }
		saving = true;
		error = '';
		const fields = {
			title: draft.title.trim(),
			description: draft.description.trim(),
			deadline: draft.deadline,
			priority: draft.priority,
			tag: draft.tag,
			shared: draft.shared,
		};
		try {
			if (mode === 'add') {
				const r = await addTodo(fields);
				if (!(r?.success || r?.insertedId)) throw new Error(r?.error || r?.message);
				onSaved({ ...fields, _id: r.insertedId, user: me, done: false });
				closeDialog(dialog);
				return;
			}
			const r = await updateTodo({ _id: shown._id, ...fields });
			if (!r?.success) throw new Error(r?.message);
			shown = { ...shown, ...fields };
			onSaved(shown);
			await setMode('view');
		} catch (err) {
			error = fail('save', err);
		} finally {
			saving = false;
		}
	}

	async function toggleDone() {
		if (saving) return;
		saving = true;
		error = '';
		try {
			const r = await updateTodo({ _id: shown._id, done: !shown.done });
			if (!r?.success) throw new Error(r?.message);
			shown = { ...shown, done: !shown.done };
			onSaved(shown);
		} catch (err) {
			error = fail('update it', err);
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
			const r = await deleteTodo({ id: shown._id });
			if (!r?.success) throw new Error(r?.message);
			onDeleted(shown._id);
			closeDialog(dialog);
		} catch (err) {
			error = fail('delete', err);
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
			{#if shown.done}
				<li><Icon name="check" /><span>Done</span></li>
			{/if}
			{#if deadline}
				<li class:urgent={deadline.overdue && !shown.done}>
					<Icon name="flag" />
					<span><span class="sr-only">Deadline: </span>{deadline.day} · {deadline.overdue && !shown.done ? `overdue, ${deadline.hint}` : deadline.hint}</span>
				</li>
			{/if}
			{#if priority.value > 0}
				<li><span class="dot" style:background={priority.color}></span><span>{priority.label} priority</span></li>
			{/if}
			{#if shown.tag}
				<li><Icon name="tag" /><span><span class="sr-only">Tag: </span><span class="tagchip">{shown.tag}</span></span></li>
			{/if}
			<li>
				{#if shown.shared}<Icon name="people" /><span>Shared with the household</span>
				{:else}<Icon name="lock" /><span>Private: only {canEdit ? 'you see' : 'its owner sees'} it</span>{/if}
			</li>
		</ul>
		{#if shown.description}
			<p class="notes prose">{shown.description}</p>
		{/if}
		{#if !canEdit}<p class="hint">Only the person who added it can edit it.</p>{/if}
	{:else}
		<form class="fields" id="todo-form-{uid}" on:submit|preventDefault={save} novalidate>
			<div class="field">
				<label class="label" for="todo-title-{uid}">Title</label>
				<input class="line big" id="todo-title-{uid}" bind:this={titleInput} bind:value={draft.title} maxlength="200"
					placeholder="Buy bin bags, call the plumber…" aria-invalid={titleError ? 'true' : undefined}
					aria-describedby={titleError ? `todo-title-error-${uid}` : undefined} />
				{#if titleError}<span class="field-error" id="todo-title-error-{uid}">{titleError}</span>{/if}
			</div>

			<label class="field">
				<span class="label">Notes</span>
				<textarea class="input" rows="3" bind:value={draft.description} on:keydown={submitOnModEnter} placeholder="Optional"></textarea>
			</label>

			<div class="field">
				<span class="label" id="todo-deadline-{uid}">Deadline</span>
				<div class="row">
					<input class="input" type="date" bind:value={draft.deadline} aria-labelledby="todo-deadline-{uid}" />
				</div>
				<div class="choices" role="group" aria-label="Quick deadlines">
					{#each QUICK_DEADLINES as q}
						{@const day = q.date()}
						<button type="button" class="quick" class:on={draft.deadline === day} aria-pressed={draft.deadline === day} on:click={() => (draft.deadline = day)}>{q.label}</button>
					{/each}
					<button type="button" class="quick" class:on={!draft.deadline} aria-pressed={!draft.deadline} on:click={() => (draft.deadline = '')}>None</button>
				</div>
			</div>

			<fieldset class="field">
				<legend class="label">Priority</legend>
				<div class="choices">
					{#each PRIORITIES as p}
						<label class="choice">
							<input type="radio" name="todo-priority-{uid}" value={p.value} bind:group={draft.priority} />
							<span><span class="dot" style:background={p.color}></span>{p.label}</span>
						</label>
					{/each}
				</div>
			</fieldset>

			{#if tagChoices.length}
				<fieldset class="field">
					<legend class="label">Tag</legend>
					<div class="choices">
						<label class="choice"><input type="radio" name="todo-tag-{uid}" value="" bind:group={draft.tag} /><span>No tag</span></label>
						{#each tagChoices as t}
							<label class="choice"><input type="radio" name="todo-tag-{uid}" value={t} bind:group={draft.tag} /><span>{t}</span></label>
						{/each}
					</div>
				</fieldset>
			{/if}

			<label class="switch">
				<input type="checkbox" role="switch" bind:checked={draft.shared} />
				<span class="track"></span>
				<span>Share with the household<small>{draft.shared ? 'Everyone in the household sees it' : 'Only you see it'}</small></span>
			</label>
		</form>
	{/if}

	<svelte:fragment slot="footer">
		{#if error}<p class="foot-error" role="alert">{error}</p>{/if}
		{#if mode !== 'add' && canEdit}
			<button type="button" class="delete" class:sure on:click={remove} disabled={saving}>{sure ? 'Delete for good?' : 'Delete'}</button>
		{/if}
		<span class="spacer"></span>
		{#if mode === 'view'}
			<button type="button" class="btn {canEdit ? 'btn-ghost' : 'btn-solid'}" on:click={toggleDone} disabled={saving}>
				{shown.done ? 'Mark not done' : 'Mark done'}
			</button>
			{#if canEdit}<button type="button" class="btn btn-solid" bind:this={editButton} on:click={() => setMode('edit')}>Edit</button>{/if}
		{:else}
			<button type="button" class="btn btn-ghost" on:click={() => (mode === 'add' ? closeDialog(dialog) : setMode('view'))} disabled={saving}>Cancel</button>
			<button type="submit" class="btn btn-solid" form="todo-form-{uid}" disabled={saving}>
				{saving ? 'Saving…' : mode === 'add' ? 'Add todo' : 'Save'}
			</button>
		{/if}
	</svelte:fragment>
</Sheet>
