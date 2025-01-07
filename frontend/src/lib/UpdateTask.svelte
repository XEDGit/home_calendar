<script>
	import { onMount } from 'svelte';
	import Collapsible from './collapsible.svelte';
	import Section from './Section.svelte'
	export let onSubmit = () => {};

	export let reset = () => {};

	export let delFunc = () => {};

	export let chore = {};
	chore.stats = true;

	let all_rooms = []
	onMount(async () => {
		all_rooms = await fetch('api/getRooms')
		all_rooms = await all_rooms.json()
		all_rooms = all_rooms.map((room) => {
			room.used = false;
			if (chore.rooms.find((r) => {return r._id == room._id}))
				room.used = true;
			return room;
		})
		console.log(all_rooms)
	})

	let roomsChecked = [];

	function checkRooms(newel, event) {
		if (event.target.checked) {
			roomsChecked.push(newel._id);
		} else {
			roomsChecked = roomsChecked.filter(item => item !== newel);
		}
	}

	let newRooms = chore.rooms.map(room => room._id)

	function updateRooms(newel, checked) {
		if (checked) {
			newRooms.push(newel);
		} else {
			newRooms = newRooms.filter(item => item !== newel);
		}
	}


	// Submit the selected checkboxes
	function submit() {
		chore.newRooms = newRooms;
		chore.rooms = roomsChecked;
		chore.id = chore._id;
		onSubmit(chore); // Pass selected checkboxes to the submit function
	}

	function formatNextTime(value) {
        if (value <= 30) {
            return `${value} day${value === 1 ? '' : 's'}`;
        } else {
            // Convert 31–42 to 1–12 for months
            let month = (value - 31) % 12 + 1;
            return `${month} month${month === 1 ? '' : 's'}`;
        }
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
		height: 90%;
		overflow-x: hidden;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-items: flex-start;
		position: relative;
	}

	.userButtons {
		flex-direction: column;
		width: 100%;
		height: auto;
		min-height: auto;
		align-items: flex-start;
		gap: 0;
		padding: 10px;
	}
	
	.checkbox-label {
		cursor: pointer;
		user-select: none;
	}

	.label-container {
		width: 100%;
		height: 40px;
		display: flex;
		justify-content: flex-start;
		align-items: center;
		gap: 10px;
	}

	.done {
		text-decoration: line-through;
		color: #FFEAD080;
		cursor: default;
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

	.delete-button {
		float: right;
		flex: 1;
		font-size: 1.2em;
		border: 3px solid #f50a21;
		background-color: #f50a21;
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

	.name {
		background-color: #96616B;
		text-align: left;
		color: #FFEAD0;
		border: none;
		margin: 0;
		outline: none;
		font-size: large;
		box-sizing: border-box;
		padding: 10px;
		width: 100%;
		min-height: 40px;
		border-radius: 5px;
		white-space: normal;
		word-wrap: break-word;
		word-break: break-word;
	}

	h2 {
		width: 50%;
	}

	.stats-checkbox {
		border-radius: 5px;
		padding: 10px;
		position: relative;
		bottom: 0;
		margin-top: 20px;
	}

	@media (max-width: 1000px) {
		.modal-content {
			width: 70%;
		}
	}
</style>

{#if chore}
	<div class="modal" role='button' on:keydown={() => {}} tabindex=0 on:click={(e) => {e.stopPropagation(); reset()}}>
		<div class="modal-content" on:click={(e) => {e.stopPropagation()}}>
			<Section title='Task' />
			<textarea class="retro-red name" bind:value={chore.name} />
			<Section title='Rooms' />
			<div class="userButtons retro-red info-card">
				{#each chore.rooms as button}
					<label for={button._id} class='label-container'>
						<input
							type="checkbox"
							id={button._id}
							checked={button.done}
							disabled={button.done}
							on:change={(event) => checkRooms(button, event)} 
						/>
						<label for={button._id} class="checkbox-label {button.done ? 'done' : ''}">{button.name}</label><small style='color: gray;'>{button.done? 'already signed' : ''}<small></small>
					</label>
					{/each}
			</div>
			{#if chore.notes}
			<Section title='Notes' />
			<div class='retro-red' style='border-radius: 5px; text-align: left;'>
				<p style='white-space: pre-line; color: #FFEAD0; padding: 10px; margin: 0;'>{chore.notes}</p>
			</div>
			{/if}
			<div style='width: 100%; margin-top: 10px; gap: 40px; display: flex; justify-content: space-between'>
				<button class='update-button' on:click={submit}>Save</button>
				<button class='delete-button' on:click={() => {if (confirm("Are you sure you want to delete " + chore.name)) delFunc(chore._id)}}>Delete</button>
			</div>
			<div style='min-height: 20px'></div>
			<Collapsible title='Edit'>
				<div class='retro-red stats-checkbox'>
					<label><input type="checkbox" bind:checked={chore.stats} /> Statistics: {chore.stats? 'on' : 'off'}</label>
				</div>
				<Section title='Notes' />
				<div class='retro-red info-card' style='width: 92%;'>
					<textarea bind:value={chore.notes} />
				</div>
				<Section title='Repetition:' />
				<div class='retro-red' style='width: 100%; padding:10px; margin-bottom: 5px; border-radius: 5px; display: flex; flex-direction: column;'>
					<input class='range' type="range" min="1" max="42" step="1" bind:value={chore.repetition} />
					<p style='margin: 0; margin-left: 5px;'>Every {formatNextTime(chore.repetition)}</p>
				</div>
				<Section title='Rooms' />
				<div class="userButtons retro-red info-card">
					{#each all_rooms as button}
						<label for={button._id + '_add'} class='label-container'>
							<input
								type="checkbox"
								id={button._id + '_add'}
								checked={button.used}
								on:change={(event) => updateRooms(button._id, event.target.checked)} 
							/>
							<label for={button._id + '_add'} class="checkbox-label {button.done ? 'done' : ''}">{button.name}</label>
						</label>
						{/each}
				</div>
			</Collapsible>
		</div>
	</div>
{/if}
