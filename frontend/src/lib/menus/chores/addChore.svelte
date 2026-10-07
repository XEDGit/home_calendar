<script>
	import { getFrontend, postFrontend } from "$lib/requests";
	import Section from "$lib/header/Section.svelte";
	import { onMount } from "svelte";
	import { expand } from "$lib/motion";

	let newChore = {
		name: '',
		rooms: [],
		nextTime: 1,
		timeMeasure: 'days',
		notes: ''
	};

	let repeatNum = 1;
	let repeatUnit = 'days';

	$: newChore.nextTime = repeatUnit === 'days'
		? Math.min(30, Math.max(1, Number(repeatNum) || 1))
		: 30 + Math.min(12, Math.max(1, Number(repeatNum) || 1));

	let error = '';
	let validationMsg = '';

	async function addChore() {
		if (!newChore.rooms.length) {
			validationMsg = 'Select at least one room';
			setTimeout(() => { validationMsg = ''; }, 3000);
			return;
		}
		try {
			const response = await postFrontend('addChore', newChore);
			if (response.error) {
				throw new Error(response.error);
			}
		} catch (err) {
			error = err.message;
			return;
		}
		window.history.back();
	}

	function toggleRoom(room) {
		if (newChore.rooms.some(r => r._id == room._id)) {
			newChore.rooms = newChore.rooms.filter(r => r._id != room._id);
		} else {
			newChore.rooms = [...newChore.rooms, room];
		}
	}

	function formatRepetition() {
		const n = Number(repeatNum) || 1;
		return repeatUnit === 'days'
			? `every ${n} day${n !== 1 ? 's' : ''}`
			: `every ${n} month${n !== 1 ? 's' : ''}`;
	}

	let rooms = [];
	let roomsLoading = true;

	onMount(async () => {
		rooms = await getFrontend('getRooms');
		roomsLoading = false;
		window.scrollTo(0, 0);
	});
</script>

<style>
	.page {
		width: 90%;
		margin: 0 auto;
		padding-bottom: 120px;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.card {
		background-color: var(--primary);
		border-radius: var(--radius-lg);
		padding: 16px;
		box-sizing: border-box;
	}

	/* Name input: underline style on rose bg */
	.name-input {
		width: 100%;
		background-color: transparent;
		color: var(--paper);
		border: none;
		border-bottom: var(--bw) solid var(--paper-a60);
		font-size: var(--text-base);
		padding: 8px 0;
		box-sizing: border-box;
		font-family: inherit;
		margin-top: 4px;
	}

	.name-input::placeholder {
		color: var(--paper);
		font-style: italic;
		font-weight: var(--weight-regular);
	}

	.name-input:focus {
		border-bottom-color: var(--paper);
	}

	/* Room chips on rose card: inverted palette */
	.chips-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}

	.room-chip {
		padding: 10px 16px;
		border-radius: var(--radius-pill);
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		min-height: 44px;
		cursor: pointer;
		transition: var(--swap);
		touch-action: manipulation;
		user-select: none;
		-webkit-user-select: none;
		font-family: inherit;
	}

	.room-chip.selected {
		background-color: var(--paper);
		color: var(--primary);
		border: var(--bw) solid var(--paper);
	}

	.room-chip.selected::before {
		content: '✓ ';
	}

	/* Unselected: dashed outline instead of fading, so the label stays readable */
	.room-chip.unselected {
		background-color: transparent;
		color: var(--paper);
		border: var(--bw) dashed var(--paper);
		font-weight: var(--weight-regular);
	}

	.rooms-loading {
		color: var(--paper);
		font-style: italic;
		font-size: var(--text-sm);
		margin-top: 8px;
	}

	.validation-msg {
		color: var(--paper);
		font-size: var(--text-xs);
		font-style: italic;
		margin: 8px 0 0;
	}

	/* Repeat input */
	.repeat-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		flex-wrap: wrap;
	}

	.repeat-label {
		color: var(--paper);
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
	}

	.repeat-num {
		box-sizing: border-box;
		width: 72px;
		padding: 9px;
		background-color: var(--paper-a12);
		border: var(--bw) solid var(--paper-a60);
		border-radius: var(--radius-md);
		color: var(--paper);
		font-size: var(--text-base);
		text-align: center;
		font-family: inherit;
	}

	.repeat-num:focus {
		border-color: var(--paper);
	}

	/* Days and Months are one choice: they wrap to a new line together */
	.unit-group {
		display: flex;
		gap: 8px;
	}

	.unit-btn {
		padding: 9px 14px;
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
		touch-action: manipulation;
		font-family: inherit;
		min-height: 44px;
	}

	.unit-btn.active {
		background-color: var(--paper);
		color: var(--primary);
		border: var(--bw) solid var(--paper);
	}

	.unit-btn.inactive {
		background-color: transparent;
		color: var(--paper);
		border: var(--bw) dashed var(--paper);
		font-weight: var(--weight-regular);
	}

	.repeat-preview {
		color: var(--paper);
		font-size: var(--text-xs);
		margin: 6px 0 0;
		font-style: italic;
	}

	/* Notes textarea */
	.notes-input {
		width: 100%;
		background-color: var(--paper-a12);
		border: var(--bw) solid var(--paper-a35);
		border-radius: var(--radius-md);
		padding: var(--space-sm);
		color: var(--paper);
		resize: none;
		min-height: 100px;
		box-sizing: border-box;
		font-size: var(--text-base);
		font-family: inherit;
		margin-top: 8px;
	}

	.notes-input::placeholder {
		color: var(--paper);
		font-style: italic;
	}

	.notes-input:focus {
		border-color: var(--paper);
	}

	/* Submit */
	.submit-btn {
		width: 100%;
		padding: var(--block-pad);
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		background-color: var(--primary);
		color: var(--paper);
		font-size: var(--text-base);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
		touch-action: manipulation;
		font-family: inherit;
	}

	@media (hover: hover) {
		.submit-btn:hover {
			background-color: var(--paper);
			color: var(--primary);
		}
	}

	.error-msg {
		color: var(--urgent);
		margin: 24px 0 12px;
		font-size: var(--text-base);
	}

	.retry-btn {
		padding: var(--control-pad-y) var(--control-pad-x);
		min-height: var(--control-min-h);
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		background-color: var(--paper);
		color: var(--primary);
		font-weight: var(--weight-bold);
		cursor: pointer;
		font-family: inherit;
		transition: var(--swap);
	}
</style>

<div class="page">
	{#if error}
		<p class="error-msg">Error: {error}</p>
		<button class="retry-btn" on:click={() => { error = ''; }}>Try again</button>
	{:else}
		<form on:submit|preventDefault={addChore}>
			<div class="card on-primary">
				<Section title="Task" color="var(--paper)" />
				<input
					type="text"
					class="name-input"
					bind:value={newChore.name}
					placeholder="What needs to be done?"
					required
				/>
			</div>

			<div class="card on-primary">
				<Section title="Rooms" subcolor="var(--paper-a60)" subtitle="where?" color="var(--paper)" />
				{#if roomsLoading}
					<p class="rooms-loading">Loading rooms...</p>
				{:else if rooms.length}
					<div class="chips-grid">
						{#each rooms as room}
							<button
								type="button"
								class="room-chip {newChore.rooms.some(r => r._id == room._id) ? 'selected' : 'unselected'}"
								aria-pressed={newChore.rooms.some(r => r._id == room._id)}
								on:click={() => toggleRoom(room)}
							>
								{room.name}
							</button>
						{/each}
					</div>
					{#if validationMsg}
						<p class="validation-msg" role="alert" transition:expand>{validationMsg}</p>
					{/if}
				{:else}
					<p class="rooms-loading">No rooms set up yet. Add rooms in Settings.</p>
				{/if}
			</div>

			<div class="card on-primary">
				<Section title="Repeat" subcolor="var(--paper-a60)" subtitle="how often?" color="var(--paper)" />
				<div class="repeat-row">
					<span class="repeat-label">Every</span>
					<input
						type="number"
						class="repeat-num"
						min="1"
						max={repeatUnit === 'days' ? 30 : 12}
						bind:value={repeatNum}
					/>
					<span class="unit-group">
						<button
							type="button"
							class="unit-btn {repeatUnit === 'days' ? 'active' : 'inactive'}"
							aria-pressed={repeatUnit === 'days'}
							on:click={() => { repeatUnit = 'days'; repeatNum = Math.min(30, Number(repeatNum) || 1); }}
						>Days</button>
						<button
							type="button"
							class="unit-btn {repeatUnit === 'months' ? 'active' : 'inactive'}"
							aria-pressed={repeatUnit === 'months'}
							on:click={() => { repeatUnit = 'months'; repeatNum = Math.min(12, Number(repeatNum) || 1); }}
						>Months</button>
					</span>
				</div>
				<p class="repeat-preview">Repeats {formatRepetition()}</p>
			</div>

			<div class="card on-primary">
				<Section title="Notes" subcolor="var(--paper-a60)" subtitle="optional" color="var(--paper)" />
				<textarea
					class="notes-input"
					bind:value={newChore.notes}
					placeholder="Any details..."
				></textarea>
			</div>

			<button type="submit" class="submit-btn">Add chore</button>
		</form>
	{/if}
</div>
