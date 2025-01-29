<script>
	import { onMount } from 'svelte';
	import SelectButtons from '$lib/buttons/selectButtons.svelte';
	import Section from '$lib/header/Section.svelte'
    import { getFrontend, getUsers } from '$lib/requests';
    import Collapsible from '$lib/containers/collapsible.svelte';
    import getCookie from '$lib/helpers/getCookie';
	export let onSubmit = () => {};

	export let reset = () => {};

	export let delFunc = () => {};

	export let chore = {};
	export let users = [];
	chore.stats = true;

	let all_rooms = []
	onMount(async () => {
		users = await getUsers();
		chore.who = getCookie('user');
		all_rooms = await getFrontend('getRooms');
		all_rooms = all_rooms.map((room) => {
			room.used = false;
			if (chore.rooms.find((r) => {return r._id == room._id}))
				room.used = true;
			return room;
		});
	})

	let roomsChecked = [];

	function checkRooms(newel, event) {
		if (event.target.checked) {
			roomsChecked = [...roomsChecked, newel._id];
		} else {
			roomsChecked = roomsChecked.filter(item => item !== newel._id);
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

	function update() {
		chore.newRooms = newRooms;
		const swap_tmp = chore.rooms;
		chore.rooms = [];
		chore.id = chore._id;
		onSubmit(chore);
		chore.rooms = swap_tmp;
	}

	function submit() {
		chore.rooms = roomsChecked;
		chore.id = chore._id;
		onSubmit(chore);
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

	let editMode = false;
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
		max-height: 90%;
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

	.sign-checkbox:checked {
		background-color: green;
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
		width: 100%;
		user-select: none;
		margin-bottom: 10px;
	}

	.tooltip {
		color: gray;
		font-style: italic;
		text-align: left;
		font-size: 0.7em;
		width: 90%;
		margin-left: 1%;
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
			<SelectButtons hooks={{"Sign": () => {if (editMode) editMode = false;}, "Edit": () => {if (!editMode) editMode = true;}}} />
			<h1 style='color: #96616B; margin: 0; width: 100%; font-weight: bold; font-size: 1.2em; padding: 10px 0;'>{chore.name}</h1>
			{#if !editMode}
				<small class='tooltip'>Check the boxes for the rooms you’ve completed, then click the button below to sign off</small>
				<div class="userButtons retro-red info-card">
					{#each chore.rooms as button}
						<label for={button._id} class='label-container'>
							<input
								type="checkbox"
								id={button._id}
								class='sign-checkbox'
								checked={button.done}
								disabled={button.done}
								on:change={(event) => checkRooms(button, event)} 
							/>
							<label for={button._id} class="checkbox-label {button.done ? 'done' : ''}">{button.name}</label><small style='color: gray;'>{button.done? 'already signed' : ''}<small></small>
						</label>
						{/each}
				</div>
				{#if chore.notes}
				<h3 style='color: #96616B; width: fit-content; margin: 0;'>Notes</h3>
				<div class='retro-red' style='border-radius: 5px; text-align: left; margin-bottom: 15px;'>
					<p style='white-space: pre-line; color: #FFEAD0; padding: 10px; margin: 0;'>{chore.notes}</p>
				</div>
				{/if}
				<div style='width: 100%; margin-bottom: 20px; gap: 40px; display: flex; justify-content: space-between'>
					<button disabled={roomsChecked.length == 0} class='update-button' on:click={submit}>{`Sign ${roomsChecked.length} rooms`}</button>
				</div>
				<h3 style='color: #96616B; width: fit-content; margin: 0;'>Options:</h3>
				<small class='tooltip'>Set to record your signature in the statistics</small>
				<div class='retro-red stats-checkbox'>
					<label><input type="checkbox" bind:checked={chore.stats} /> Stats: {chore.stats? 'on' : 'off'}</label>
				</div>
				<small class='tooltip'>Click here to change who is signing for these rooms</small>
				<Collapsible title='Change user'>
					<div style='min-height: 5px'></div>
					<SelectButtons selected_value={users.findIndex((user) => {return user._id == chore.who})} hooks={
						Object.fromEntries(users.map((user) => {return [user.name, () => {chore.who = user._id}]}))
					} />
				</Collapsible>
				<div style='min-height: 20px'></div>
			{:else}
				<Section title='Name' />
				<textarea class="retro-red name" bind:value={chore.name} />
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
				<div style='width: 100%; margin-top: 10px; gap: 40px; display: flex; justify-content: space-between'>
					<button class='update-button' on:click={update}>Save changes</button>
					<button class='delete-button' on:click={() => {if (confirm("Are you sure you want to delete " + chore.name + '? This WILL DELETE ALL the statistics tied to it and is NOT revertible')) delFunc(chore._id)}}>Delete</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
