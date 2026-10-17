<script>
	// Change the household's password. The login is shared by the whole
	// household, so every other device (family phones too) has to log in
	// again afterwards; this one stays logged in.
	import { onMount, tick } from 'svelte';
	import { closeDialog, morphHeight } from '#lib/motion.js';
	import { changePassword } from '#lib/requests.js';
	import Sheet from './Sheet.svelte';

	export let onClose = () => {};

	const MIN = 8; // backend/password.js MIN_LENGTH
	const FIELDS = [
		{ id: 'current', label: 'Current password', autocomplete: 'current-password' },
		{ id: 'next', label: 'New password', autocomplete: 'new-password', hint: `At least ${MIN} characters` },
		{ id: 'repeat', label: 'New password again', autocomplete: 'new-password' },
	];

	const uid = Math.random().toString(36).slice(2, 8);
	let dialog, doneButton;
	let inputs = {};
	let values = { current: '', next: '', repeat: '' };
	let errors = {};
	let error = '';
	let saving = false;
	let done = false;

	$: typed = !!(values.current || values.next || values.repeat);

	onMount(() => inputs.current?.focus());

	function check({ current, next, repeat }) {
		if (!current) return { current: 'Type the current password' };
		if (next.length < MIN) return { next: `Use at least ${MIN} characters` };
		if (next === current) return { next: 'That is the same as the current password' };
		if (repeat !== next) return { repeat: "The two new passwords don't match" };
		return {};
	}

	// Errors land under their field, and focus goes there
	function show(found) {
		errors = found;
		const id = FIELDS.find((f) => errors[f.id])?.id;
		inputs[id]?.focus();
		return !!id;
	}

	async function save() {
		if (saving) return;
		error = '';
		if (show(check(values))) return;
		saving = true;
		try {
			const r = await changePassword(values.current, values.next);
			if (r?.field === 'current' || r?.field === 'password') {
				show({ [r.field === 'current' ? 'current' : 'next']: r.error });
				return;
			}
			if (r?.error) {
				error = r.error;
				return;
			}
			const settle = morphHeight(dialog);
			done = true;
			values = { current: '', next: '', repeat: '' };
			await tick();
			settle();
			doneButton?.focus();
		} catch {
			error = "Couldn't change it. Try again.";
		} finally {
			saving = false;
		}
	}
</script>

<Sheet kind="Change password" lockBackdrop={typed && !done} {onClose} bind:dialog>
	{#if done}
		<h2 class="entry-title">Password changed</h2>
		<p class="notes">Every other device has to log in again with the new password. This one stays logged in.</p>
	{:else}
		<p class="hint">This is the household's login: afterwards every other device, your family's too, has to log in again.</p>
		<form class="fields" id="password-form-{uid}" on:submit|preventDefault={save} novalidate>
			{#each FIELDS as f (f.id)}
				{@const note = errors[f.id] ? `password-${f.id}-error-${uid}` : f.hint ? `password-${f.id}-hint-${uid}` : undefined}
				<div class="field">
					<label class="label" for="password-{f.id}-{uid}">{f.label}</label>
					<input class="line" type="password" id="password-{f.id}-{uid}" autocomplete={f.autocomplete}
						maxlength="1024" bind:this={inputs[f.id]} bind:value={values[f.id]}
						aria-invalid={errors[f.id] ? 'true' : undefined} aria-describedby={note} />
					{#if errors[f.id]}
						<span class="field-error" id="password-{f.id}-error-{uid}">{errors[f.id]}</span>
					{:else if f.hint}
						<span class="hint" id="password-{f.id}-hint-{uid}">{f.hint}</span>
					{/if}
				</div>
			{/each}
		</form>
	{/if}
	<svelte:fragment slot="footer">
		{#if error}<p class="foot-error" role="alert">{error}</p>{/if}
		<span class="spacer"></span>
		{#if done}
			<button type="button" class="btn btn-solid" bind:this={doneButton} on:click={() => closeDialog(dialog)}>Done</button>
		{:else}
			<button type="button" class="btn btn-ghost" on:click={() => closeDialog(dialog)} disabled={saving}>Cancel</button>
			<button type="submit" class="btn btn-solid" form="password-form-{uid}" disabled={saving}>
				{saving ? 'Saving…' : 'Change password'}
			</button>
		{/if}
	</svelte:fragment>
</Sheet>
