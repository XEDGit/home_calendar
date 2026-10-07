<script>
	import { onMount, tick } from 'svelte';
	import { modalDialog, closeDialog, morphHeight } from '$lib/motion';
	import SelectButtons from '$lib/buttons/selectButtons.svelte';
	import Section from '$lib/header/Section.svelte';
	import GroupIcon from '$lib/icons/GroupIcon.svelte';
	import { getCookie } from '$lib/helpers/getCookie';
	import { getTags } from '$lib/requests';

	export let onSubmit = () => {};
	export let reset = () => {};
	export let delFunc = () => {};
	export let todo = {};
	todo.priority = String(todo.priority);
	if (todo.deadline)
		todo.deadline = formatDate(todo.deadline);
	function formatDate(date) {
        if (!date)
            return '';
        date = new Date(date);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    }

	let tags = [];
	let editMode = false;
	let user = '';

	onMount(async () => {
		tags = await getTags();
		user = getCookie('user');
	});

	function update() {
		todo.id = todo._id;
		onSubmit(todo);
		closeDialog(dialogEl);
	}

	function deleteTodo() {
		delFunc(todo._id);
		closeDialog(dialogEl);
	}

	function toggleDone() {
		todo.done = !todo.done;
		update();
	}

	// Native modal dialog; modalDialog animates it in and out
	let dialogEl;

	// View ↔ edit changes the dialog's height: morph it instead of jumping
	async function switchMode(next) {
		if (editMode === next) return;
		const settle = morphHeight(dialogEl);
		editMode = next;
		await tick();
		settle();
	}
</script>

<style>
	/* Native <dialog>: top layer, focus trap, Escape and inert background come free */
	.modal-content {
		border: none;
		margin: auto;
	}

	dialog.modal-content {
		padding-top: calc(44px + var(--space-md));
	}

	.modal-content:not([open]) {
		display: none;
	}

	.close-btn {
		position: absolute;
		top: var(--space-sm);
		right: var(--space-sm);
		width: 44px;
		height: 44px;
		padding: 0;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-circle);
		background: var(--paper);
		color: var(--primary);
		font: inherit;
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		line-height: 1;
		cursor: pointer;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.close-btn:hover {
			background: var(--primary);
			color: var(--paper);
		}
	}


	div {
		box-sizing: border-box;
	}

	.modal-content {
		background: var(--paper);
		cursor: default;
		padding: 2%;
		border-radius: var(--radius-lg);
		width: 70%;
		max-height: 90%;
		overflow-x: hidden;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-items: flex-start;
		position: relative;
		box-shadow: var(--shadow-modal);
		gap: 1em;
		font-size: var(--text-md);
	}

	textarea {
		background-color: var(--paper);
		border: none;
		border-radius: var(--radius-md);
		padding: var(--space-sm);
		color: var(--primary);
		resize: none;
		margin: 5px;
		width: 100%;
	}

	button {
		cursor: pointer;
		color: var(--paper);
		padding: var(--block-pad);
		border-radius: var(--radius-md);
		font-weight: var(--weight-bold);
		font-family: inherit;
		transition: var(--swap);
	}

	.update-button {
		float: left;
		font-size: var(--text-base);
		flex: 2;
		background-color: var(--primary);
		border: var(--bw) solid var(--primary);
	}

	.update-button:disabled {
		background-color: var(--idle);
		border: var(--bw) solid var(--idle);
	}

	@media (hover: hover) {
		.update-button:disabled:hover {
			color: var(--paper);
		}
	}

	.delete-button {
		float: right;
		flex: 1;
		font-size: var(--text-base);
		border: var(--bw) solid var(--danger);
		background-color: var(--danger);
	}

	.done-button {
		float: left;
		font-size: var(--text-base);
		flex: 1;
		border: var(--bw) solid var(--primary);
		background-color: var(--primary);
		margin-right: 10px;
	}

	@media (hover: hover) {
		button:hover {
			background-color: var(--paper);
		}

		.delete-button:hover {
			color: var(--danger);
		}

		.update-button:hover {
			color: var(--primary);
		}

		.done-button:hover {
			color: var(--primary);
		}
	}

	.name {
		color: var(--primary);
		text-align: left;
		background-color: var(--paper);
		border: var(--bw) solid var(--primary);
		margin: 0;
		font-size: var(--text-md);
		box-sizing: border-box;
		padding: var(--space-sm);
		width: 100%;
		/* Two full lines at least (a title never shows half a line), growing
		   with the text where the browser can, scrolling past twelve lines */
		line-height: var(--leading-snug);
		min-height: calc(2 * var(--leading-snug) * 1em + 2 * var(--space-sm) + 2 * var(--bw));
		max-height: calc(12 * var(--leading-snug) * 1em);
		field-sizing: content;
		overflow-y: auto;
		border-radius: var(--radius-md);
		white-space: normal;
		overflow-wrap: break-word;
		margin-top: -30px;
	}

	.tooltip {
		color: var(--primary);
		font-style: italic;
		text-align: left;
		font-size: var(--text-xs);
		width: 90%;
		margin-left: 1%;
	}

	.priority-indicator {
		display: inline-block;
		width: 15px;
		height: 15px;
		border-radius: 50%;
		margin-right: 5px;
	}

	.deadline {
		color: var(--primary);
		font-weight: var(--weight-bold);
		margin-top: var(--space-sm);
	}

	.tag {
		background-color: var(--paper);
		color: var(--primary);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-pill);
		padding: var(--chip-pad-y) var(--chip-pad-x);
		margin: 5px;
		display: inline-block;
	}

	.tag::before {
		content: '# ';
	}

	select {
		padding: 8px;
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		background-color: var(--paper);
		color: var(--primary);
		width: 100%;
		margin-bottom: 10px;
		margin-top: -30px;

	}

	input[type="date"] {
		box-sizing: border-box;
		padding: 8px;
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		background-color: var(--paper);
		color: var(--primary);
		width: 100%;
		margin-bottom: 10px;
		margin-top: -30px;
	}

	input[type="checkbox"] {
		width: 24px;
		height: 24px;
		margin-right: 10px;
	}

	@media (max-width: 1000px) {
		.modal-content {
			width: 90%;
		}
	}
</style>

{#if todo}
	<dialog class="dialog modal-content" aria-label={todo.title} bind:this={dialogEl} use:modalDialog on:close={() => reset()}>
		<button type="button" class="close-btn" aria-label="Close" on:click={() => closeDialog(dialogEl)}>×</button>
			{#if user == todo.user}
			<SelectButtons hooks={{"View": () => switchMode(false), "Edit": () => switchMode(true)}} />
			{/if}
			<h1 style='color: var(--primary); margin: 0; width: 100%; font-weight: var(--weight-bold); font-size: var(--text-lg); padding: 10px 0;'>{todo.title}</h1>

			{#if editMode && user == todo.user}
				<!-- Edit Mode -->
				<Section title='Title*' />
				<textarea class="name" bind:value={todo.title}></textarea>

				<Section title='Description' />
				<textarea class="name" bind:value={todo.description}></textarea>

				<Section title='Tag' />
				<select bind:value={todo.tag}>
					<option value="">No Tag</option>
					{#each tags as tag}
						<option value={tag}>{tag}</option>
					{/each}
				</select>

				<Section title='Deadline' />
				<input type="date" bind:value={todo.deadline}>

				<Section title='Priority' />
				<select bind:value={todo.priority}>
					<option value="0">None</option>
					<option value="1">Low</option>
					<option value="2">Medium</option>
					<option value="3">High</option>
				</select>

				<Section title='Options' />
				<label style="display: flex; align-items: center; color: var(--primary); margin: 10px 0; margin-top: -30px;">
					<input type="checkbox" bind:checked={todo.shared} />
					<span>Share this todo</span>
				</label>

				<div style='width: 100%; margin-top: 10px; gap: 40px; display: flex; justify-content: space-between'>
					<button class='update-button' on:click={update}>Save changes</button>
					<button class='delete-button' on:click={deleteTodo}>Delete</button>
				</div>
			{:else}
				<!-- View Mode -->

				{#if todo.description}
					<h3 style='color: var(--primary); width: fit-content; margin-top: 15px; margin-bottom: 5px;'>Description</h3>
					<div class='retro-red' style='width: 100%; border-radius: var(--radius-md); text-align: left; margin-bottom: 15px;'>
						<p class="prose" style='white-space: pre-line; color: var(--paper); padding: 10px; margin: 0;'>{todo.description}</p>
					</div>
				{/if}

				{#if todo.deadline}
					<div class="deadline">
						<span>Deadline: {todo.deadline ? new Date(todo.deadline).toLocaleDateString('en-GB') : ''}</span>
					</div>
				{/if}

				{#if todo.priority && todo.priority !== '0'}
					<div style="margin-top: 10px;">
                        <span style="color: var(--primary); font-weight: var(--weight-bold);">Priority:</span>
						<span class="priority-indicator" style="background-color: {todo.priority === '3' ? 'var(--urgent)' : todo.priority === '2' ? 'var(--warn)' : todo.priority === '1'? 'var(--ok)' : 'var(--idle)'}"></span>
					</div>
				{/if}

                {#if todo.tag}
                    <div>
                        <span style="color: var(--primary); font-weight: var(--weight-bold);">Tag:</span>
                        <span class="tag">{todo.tag}</span>
                    </div>
				{/if}

				{#if todo.shared}
					<div style="display: flex; align-items: center; gap: 1em; color: var(--primary);">
							<GroupIcon /><span style='font-size:var(--text-sm);'>This todo is shared</span>
					</div>
				{/if}
			{/if}
	</dialog>
{/if}
