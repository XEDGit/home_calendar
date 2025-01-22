<script>
    import { getFrontend, postFrontend } from "$lib/requests";
	import Section from "$lib/header/Section.svelte";
    import { onMount } from "svelte";
	let newChore = {
		name: '',
		rooms: [],
		nextTime: 1,
		timeMeasure: 'days',
		notes: ''
	};

	let not_filled = '';
    let error = '';

	async function addChore() {
		if (!newChore.rooms.length) {
			not_filled = 'Select at least one room'
			setTimeout(() => {not_filled = ''}, 3000)
			return
		}
        try {
            const response = await postFrontend('addChore', newChore)
            if (!response.ok) {
                throw new Error(String(response.status) + ': Failed to add chore');
            }
        } catch (err) {
            error = err.message;
        }
        window.history.back()
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

	let rooms = []
	let modes = {
		chores: 0,
		events: 1,
	}
	let mode = modes.chores

	async function getRooms() {
		rooms = await getFrontend('getRooms')
	}

	onMount(async () => {
		await getRooms()
	})
</script>

<style>
	.card {
		background-color: #96616B;
		border-radius: 10px;
		padding: 1em 1em;
		color: #FFEAD0;
		min-width: 100%;
	}
	label, h4, hr {
		color: #FFEAD0;
	}
	label {
		font-size: 20px;
		min-height: 30px;
	}
	input[type="text"] {
		background-color: transparent;
		color: #FFEAD0;
		border: none;
		border-bottom: 2px solid #FFEAD0;
		border-radius: 4px;
		outline: none;
		width: 100%;
	}
	input[type="text"]::placeholder {
		color: #FFEAD060;
	}
	button {
		background-color: #96616B;
		border: 2px solid #96616B;
		border-radius: 7px;
		color: #FFEAD0;
		padding: 0.5rem 1rem;
	}
	button:hover {
		background-color: #FFEAD0;
		border: 2px solid #96616B;
		border-radius: 7px;
		color: #96616B;
		padding: 0.5rem 1rem;
	}

	textarea {
		background-color: #FFEAD0;
		border: none;
		border-radius: 5px;
		padding: 10px;
		color: #96616B;
		resize: none;
		height: 20vh;
		width: 90%;
		outline: none;
	}

	.error {
		color: red;
	}
</style>



{#if mode == modes.chores}
	{#if error == ''}

	<div style="width: 90%; margin: 0 auto;">
	    <form on:submit|preventDefault={addChore} style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
			<div class='card'>
				<label>
					<Section title="Name:" color='#FFEAD0' />
					<input type="text" bind:value={newChore.name} placeholder="What do you need to do?" required />
				</label>
			</div>
	        <div class='card' style="display: flex; flex-direction: column; gap: 0px;">
				<Section title="Rooms:" subcolor='#FFEAD077' subtitle='where?' color='#FFEAD0' />
	            <label>
					<input id='select-all-check' type="checkbox" on:change={(e) => {
						// Get and check all checkboxes
						const checkboxes = document.getElementsByClassName('select-all');
						for (let check of checkboxes)
							check.checked = e.target.checked;
						if (e.target.checked) {
							newChore.rooms = rooms.map(room => room);
						} else {
							newChore.rooms = [];
						}
					}} />
					Select all
					<hr />
				</label>
	            {#each rooms as room, index}
	            <label>
	                <input class='select-all' type="checkbox" bind:group={newChore.rooms} on:change={() => {document.getElementById('select-all-check').checked = newChore.rooms.length == rooms.length}} value="{room}" />
	                {room.name}
					{#if index != rooms.length-1}
						<hr />
					{/if}
	            </label>
	            {/each}
	        </div>
			<div class='card'>
				<Section title='Repetition:' subcolor='#FFEAD077' subtitle='How often?' color='#FFEAD0' />
				<input class='range' type="range" min="1" max="42" step="1" bind:value={newChore.nextTime} />
				<p style='margin: 0; margin-left: 5px;'>Every {formatNextTime(newChore.nextTime)}</p>
			</div>
			<div class='card'>
				<Section title='Notes:' color='#FFEAD0' />
				<textarea bind:value={newChore.notes} />
			</div>
			<button type="submit">Add new chore</button>
			<small class='error'>{not_filled}</small>
	    </form>
	</div>

	{:else}
	{error}
	{/if}
{:else if mode == modes.events}

{/if}