<script>
	import { onMount } from 'svelte';
	import SelectButtons from '$lib/buttons/selectButtons.svelte';
	import Section from '$lib/header/Section.svelte';
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
	}

	function deleteTodo() {
		delFunc(todo._id);
	}

	function toggleDone() {
		todo.done = !todo.done;
		update();
	}
</script>

<style>
	.modal {
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1;
		-webkit-backdrop-filter: blur(2px);
		backdrop-filter: blur(2px);
	}

	div {
		box-sizing: border-box;
	}

	.modal-content {
		background: #FFEAD0;
		cursor: default;
		padding: 2%;
		border-radius: 8px;
		width: 70%;
		max-height: 90%;
		overflow-x: hidden;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-items: flex-start;
		position: relative;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
		gap: 1em;
		font-size: 1.2em;
	}

	textarea {
		background-color: #FFEAD0;
		border: none;
		border-radius: 5px;
		padding: 10px;
		color: #96616B;
		resize: none;
		margin: 5px;
		outline: none;
		width: 100%;
	}

	button {
		cursor: pointer;
		color: #FFEAD0;
		padding: 10px;
		border-radius: 5px;
	}

	.update-button {
		float: left;
		font-size: 1.2em;
		flex: 2;
		background-color: green;
		border: solid green 3px;
	}

	.update-button:disabled {
		background-color: gray;
		border: solid 3px gray;
	}

	.update-button:disabled:hover {
		color: #FFEAD0;
	}

	.delete-button {
		float: right;
		flex: 1;
		font-size: 1.2em;
		border: 3px solid #f50a21;
		background-color: #f50a21;
	}

	.done-button {
		float: left;
		font-size: 1.2em;
		flex: 1;
		border: 3px solid #96616B;
		background-color: #96616B;
		margin-right: 10px;
	}

	button:hover {
		background-color: #FFEAD0;
	}

	.delete-button:hover {
		color: #f50a21;
	}

	.update-button:hover {
		color: green;
	}

	.done-button:hover {
		color: #96616B;
	}

	.name {
		color: #96616B;
		text-align: left;
		background-color: #FFEAD0;
		border: solid 2px #96616B;
		margin: 0;
		outline: none;
		font-size: large;
		box-sizing: border-box;
		padding: 10px;
		width: 100%;
		min-height: 3em;
		overflow: hidden;
		border-radius: 5px;
		white-space: normal;
		word-wrap: break-word;
		word-break: break-word;
		margin-top: -30px;
	}

	.tooltip {
		color: gray;
		font-style: italic;
		text-align: left;
		font-size: 0.7em;
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
		color: #96616B;
		font-weight: bold;
		margin-top: 10px;
	}

	.tag {
		background-color: #FFEAD0;
		color: #96616B;
		border: solid 2px #96616B;
		border-radius: 5px;
		padding: 5px 10px;
		margin: 5px;
		display: inline-block;
	}

	.tag::before {
		content: '# ';
	}

	select {
		padding: 8px;
		border-radius: 4px;
		border: 1px solid #96616B;
		background-color: #FFEAD0;
		color: #96616B;
		width: 100%;
		margin-bottom: 10px;
		margin-top: -30px;

	}

	input[type="date"] {
		padding: 8px;
		border-radius: 4px;
		border: 1px solid #96616B;
		background-color: #FFEAD0;
		color: #96616B;
		width: 100%;
		margin-bottom: 10px;
		margin-top: -30px;
	}

	input[type="checkbox"] {
		width: 20px;
		height: 20px;
		margin-right: 10px;
	}

	@media (max-width: 1000px) {
		.modal-content {
			width: 90%;
		}
	}
</style>

{#if todo}
	<div class="modal" role="dialog" aria-modal="true" on:keydown={(e) => { if (e.key === 'Escape') reset(); }} tabindex="-1" on:click={(e) => {e.stopPropagation(); reset()}}>
		<div class="modal-content" on:click={(e) => {e.stopPropagation()}}>
			{#if user == todo.user}
			<SelectButtons hooks={{"View": () => {if (editMode) editMode = false;}, "Edit": () => {if (!editMode) editMode = true;}}} />
			{/if}
			<h1 style='color: #96616B; margin: 0; width: 100%; font-weight: bold; font-size: 1.4em; padding: 10px 0;'>{todo.title}</h1>

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
				<label style="display: flex; align-items: center; color: #96616B; margin: 10px 0; margin-top: -30px;">
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
					<h3 style='color: #96616B; width: fit-content; margin-top: 15px; margin-bottom: 5px;'>Description</h3>
					<div class='retro-red' style='width: 100%; border-radius: 5px; text-align: left; margin-bottom: 15px;'>
						<p style='white-space: pre-line; color: #FFEAD0; padding: 10px; margin: 0;'>{todo.description}</p>
					</div>
				{/if}

				{#if todo.deadline}
					<div class="deadline">
						<span>Deadline: {todo.deadline ? new Date(todo.deadline).toLocaleDateString('en-GB') : ''}</span>
					</div>
				{/if}

				{#if todo.priority && todo.priority !== '0'}
					<div style="margin-top: 10px;">
                        <span style="color: #96616B; font-weight: bold;">Priority:</span>
						<span class="priority-indicator" style="background-color: {todo.priority === '3' ? 'red' : todo.priority === '2' ? 'orange' : todo.priority === '1'? 'green' : 'gray'}"></span>
					</div>
				{/if}

                {#if todo.tag}
                    <div>
                        <span style="color: #96616B; font-weight: bold;">Tag:</span>
                        <span class="tag">{todo.tag}</span>
                    </div>
				{/if}

				{#if todo.shared}
					<div style="display: flex; align-items: center; gap: 1em; color: #96616B;">
							<i class="material-icons">group</i><span style='font-size:.9em;'>This todo is shared</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{/if}