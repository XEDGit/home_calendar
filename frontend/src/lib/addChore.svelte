<script>
	let newChore = {
		name: '',
		rooms: [],
		nextTime: 1,
		timeMeasure: 'days',
	};

    let error = '';

	async function addChore() {
        try {
            if (newChore.nextTime == 1) {
                newChore.timeMeasure = 'day';
            } else if (newChore.nextTime == 31) {
                newChore.timeMeasure = 'month';
            } else if (newChore.nextTime > 31) {
                newChore.timeMeasure = 'months';
            }
            const response = await fetch('api/addChore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
				credentials: 'include',
                body: JSON.stringify(newChore)
            });
			console.log(newChore)
            const createdChore = await response.json()
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
	function getRooms() {
		fetch('api/getRooms', {
			method: 'GET',
		}).then(res => 
			res.json().then(json => {
				rooms = json;
			})
		)
	}
	getRooms()
</script>

<style>
	.card {
		background-color: #96616B;
		border-radius: 10px;
		padding: 1em 1em;
		color: #FFEAD0;
		min-width: 200px;
	}
	.range {
		background: #FFEAD0;
		border-radius: 10px;
		width: 100%;
		appearance: none;
		-webkit-appearance: none;
	}
	.range::-webkit-slider-thumb {
		background-color: #96616B;
		border: 1px solid #FFEAD0;
		width: 10%;
		height: 110%;
	}
	.range::-moz-range-thumb {
		background-color: #96616B;
		border: 2px solid #FFEAD0;
		width: 10%;
		height: 110%;
		border-radius: 50%;
	}
	input[type="checkbox"] {
		appearance: none;
		-webkit-appearance: none;
		align-content: center;
		justify-content: center;
		font-size: 2rem;
		padding: 0.25rem;
		border: 2px solid #FFEAD0;
		background-color: #FFEAD0;
		border-radius: 50%;
		margin: 0;
	}
	input[type="checkbox"]:checked {
		background-color: #96616B;
	}
	label, h4, hr {
		color: #FFEAD0;
	}
	input[type="text"] {
		background-color: transparent;
		border: none;
		border-bottom: 2px solid #FFEAD0;
		border-radius: 4px;
		outline: none;
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
</style>

{#if error == ''}

<div style="width: 80%; margin: 0 auto;">
    <form on:submit|preventDefault={addChore} style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
		<div class='card'>
			<label>
				<h4 style='margin: 0;'>Name:</h4>
				<hr style='width: 100%;' />
				<input type="text" bind:value={newChore.name} placeholder="Type name here" required />
			</label>
		</div>
        <div class='card' style="display: flex; flex-direction: column; gap: 0px;">
			<h4 style='margin: 0;'>Rooms:</h4>
			<hr style='width: 100%;' />
            <label>
				<input type="checkbox" on:change={(e) => {
					// Get and check all checkboxes
					const checkboxes = document.getElementsByClassName('select-all');
					for (let check of checkboxes)
						check.checked = e.target.checked;
					// Add to newChore.rooms array manually
					if (e.target.checked) {
						newChore.rooms = rooms.map(room => room);
					} else {
						newChore.rooms = [];
					}
				}} />
				Select all
			</label>
            {#each rooms as room}
            <label>
                <input class='select-all' type="checkbox" bind:group={newChore.rooms} value="{room}" />
                {room.name}
            </label>
            {/each}
        </div>
		<div class='card'>
			<input class='range' type="range" min="1" max="42" step="1" bind:value={newChore.nextTime} />
			<p style='margin: 0; margin-left: 5px;'>Every {formatNextTime(newChore.nextTime)}</p>
		</div>
		<button type="submit">Add new</button>
    </form>
</div>

{:else}
{error}
{/if}