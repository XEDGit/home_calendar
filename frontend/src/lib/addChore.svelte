<script>
	let newChore = {
		name: '',
		rooms: [],
		nextTime: 1,
        nextTimeMeasure: 'days',
	};

    let error = '';

	async function addChore() {
        try {
            const response = await fetch('api/addChore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
				credentials: 'include',
                body: JSON.stringify(newChore)
            });
            const createdChore = await response.json()
            if (!response.ok) {
                throw new Error(String(response.status) + ': Failed to add chore');
            }
            window.location = '/';
        } catch (err) {
            error = err.message;
        }
    }

    export let rooms;

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

{#if error == ''}

<div style="width: 80%; margin: 0 auto;">
    <form on:submit|preventDefault={addChore} style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
        <input type="text" bind:value={newChore.name} placeholder="Event Title" required />
        <div style="display: flex; flex-direction: column; gap: 0px">
            {#each rooms as room}
            <label>
                <input type="checkbox" bind:group={newChore.rooms} value="{room}" />
                {room}
            </label>
            {/each}
        </div>
        <input type="range" min="1" max="42" step="1" bind:value={newChore.nextTime} />
        <p>{formatNextTime(newChore.nextTime)}</p>
        <button type="submit">Add Chore</button>
    </form>
</div>

{:else}
{error}
{/if}