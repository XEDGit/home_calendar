<script>
	import { onMount, tick } from 'svelte';
	import { DUR, ms, morphHeight, reducedMotion } from '$lib/motion';
	import SelectButtons from '$lib/buttons/selectButtons.svelte';
	import Section from '$lib/header/Section.svelte';
	import { getFrontend, getUsers } from '$lib/requests';
	import { getCookie } from '$lib/helpers/getCookie';

	export let onSubmit = () => {};
	export let reset = () => {};
	export let skip = () => {};
	export let delFunc = () => {};
	export let chore = {};
	export let users = [];

	chore.stats = true;

	// Pre-select all rooms not yet completed in this cycle
	let roomsChecked = chore.rooms.filter(r => !r.done).map(r => r._id);
	let newRooms = chore.rooms.map(r => r._id);
	let all_rooms = [];

	// Repetition state for edit mode
	const rep = Number(chore.repetition) || 1;
	let repeatNum = rep <= 30 ? rep : rep - 30;
	let repeatUnit = rep <= 30 ? 'days' : 'months';

	$: chore.repetition = repeatUnit === 'days'
		? Math.min(30, Math.max(1, Number(repeatNum) || 1))
		: 30 + Math.min(12, Math.max(1, Number(repeatNum) || 1));

	let panelEl;

	onMount(async () => {
		// Move focus into the panel so keyboard users land on what just opened
		panelEl?.focus({ preventScroll: true });
		// Bring it into view once the expand has finished growing it
		setTimeout(
			() => panelEl?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }),
			ms(DUR.base)
		);
		users = await getUsers();
		chore.who = getCookie('user');
		all_rooms = await getFrontend('getRooms');
	});

	function toggleSignRoom(roomId) {
		if (roomsChecked.includes(roomId)) {
			roomsChecked = roomsChecked.filter(id => id !== roomId);
		} else {
			roomsChecked = [...roomsChecked, roomId];
		}
	}

	function toggleEditRoom(roomId) {
		if (newRooms.includes(roomId)) {
			newRooms = newRooms.filter(id => id !== roomId);
		} else {
			newRooms = [...newRooms, roomId];
		}
	}

	function submit() {
		chore.rooms = roomsChecked;
		chore.id = chore._id;
		onSubmit(chore);
	}

	function update() {
		chore.newRooms = newRooms;
		const savedRooms = chore.rooms;
		chore.rooms = [];
		chore.id = chore._id;
		onSubmit(chore);
		chore.rooms = savedRooms;
	}

	function formatRepetition() {
		const n = Number(repeatNum) || 1;
		return repeatUnit === 'days'
			? `every ${n} day${n !== 1 ? 's' : ''}`
			: `every ${n} month${n !== 1 ? 's' : ''}`;
	}

	let editMode = false;

	// Sign ↔ edit changes the panel's height: morph it so rows below glide
	async function switchMode(next) {
		if (editMode === next) return;
		const settle = morphHeight(panelEl);
		editMode = next;
		await tick();
		settle();
	}

	$: allDone = chore.rooms?.length > 0 && chore.rooms.every(r => r.done);
</script>

<style>
	/* Inline panel: expands in place under the chore row it belongs to */
	.panel {
		background: var(--paper);
		color: var(--primary);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-lg);
		padding: var(--space-md) var(--space-md) var(--space-lg);
		margin: 6px 0 var(--space-md);
		box-sizing: border-box;
		cursor: auto;
		text-align: left;
	}

	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.close-btn {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
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

	.chore-title {
		color: var(--primary);
		font-size: var(--text-md);
		font-weight: var(--weight-bold);
		margin: 8px 0 16px;
		text-transform: lowercase;
		word-break: break-word;
	}

	.chore-title::first-letter {
		text-transform: uppercase;
	}

	.helper {
		font-size: var(--text-xs);
		color: var(--ink);
		font-style: italic;
		margin: 4px 0 8px;
	}

	.divider {
		border: none;
		border-top: var(--bw-hair) solid var(--primary-a25);
		margin: 14px 0;
	}

	/* Room chips */
	.chips-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin: 10px 0;
	}

	.room-chip {
		padding: 10px 16px;
		border-radius: var(--radius-pill);
		border: var(--bw) solid var(--primary);
		cursor: pointer;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		min-height: 44px;
		transition: var(--swap);
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		font-family: inherit;
	}

	.room-chip.selected {
		background-color: var(--primary);
		color: var(--paper);
	}

	.room-chip.selected::before {
		content: '✓ ';
	}

	/* Unselected: dashed outline instead of fading, so the label stays readable */
	.room-chip.unselected {
		background-color: var(--paper);
		color: var(--primary);
		border-style: dashed;
		font-weight: var(--weight-regular);
	}

	.room-chip.already-done {
		background-color: var(--paper);
		color: var(--primary);
		opacity: 0.3;
		cursor: default;
		text-decoration: line-through;
	}

	/* Notes box */
	.notes-box {
		background-color: var(--primary);
		border-radius: var(--radius-md);
		padding: 10px 14px;
		margin-bottom: 12px;
	}

	.notes-text {
		color: var(--paper);
		white-space: pre-line;
		font-size: var(--text-sm);
		margin: 0;
	}

	/* Stats toggle */
	.stats-row {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 12px;
	}

	.stats-btn {
		padding: var(--control-pad-y) var(--control-pad-x);
		min-height: var(--control-min-h);
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		cursor: pointer;
		font-size: var(--text-xs);
		font-weight: var(--weight-bold);
		transition: var(--swap);
		touch-action: manipulation;
		font-family: inherit;
	}

	.stats-btn.on {
		background-color: var(--primary);
		color: var(--paper);
	}

	.stats-btn.off {
		background-color: var(--paper);
		color: var(--primary);
		border-style: dashed;
	}

	/* Sign button */
	.sign-btn {
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
		margin-top: 12px;
		touch-action: manipulation;
		font-family: inherit;
	}

	.sign-btn:disabled {
		background-color: var(--idle);
		border-color: var(--idle);
		color: var(--paper);
		cursor: not-allowed;
	}

	@media (hover: hover) {
		.sign-btn:not(:disabled):hover {
			background-color: var(--paper);
			color: var(--primary);
		}
	}

	/* Edit mode form */
	.edit-input {
		width: 100%;
		padding: 10px;
		background-color: var(--paper);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		color: var(--ink);
		font-size: var(--text-base);
		box-sizing: border-box;
		margin-bottom: 8px;
		font-family: inherit;
	}

	.edit-input:focus {
		border-color: var(--primary-deep);
		box-shadow: var(--focus-ring);
	}

	textarea.edit-input {
		resize: none;
		min-height: 80px;
	}

	/* Repeat input */
	.repeat-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px 0;
	}

	.repeat-num {
		width: 72px;
		padding: 10px;
		background-color: var(--paper);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		color: var(--ink);
		font-size: var(--text-base);
		text-align: center;
		font-family: inherit;
	}

	.repeat-num:focus {
		border-color: var(--primary-deep);
	}

	.unit-btn {
		padding: 10px 16px;
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		cursor: pointer;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		transition: var(--swap);
		touch-action: manipulation;
		font-family: inherit;
		min-height: 44px;
	}

	.unit-btn.active {
		background-color: var(--primary);
		color: var(--paper);
	}

	.unit-btn.inactive {
		background-color: var(--paper);
		color: var(--primary);
	}

	/* Action buttons */
	.action-row {
		display: flex;
		gap: 12px;
		margin-top: 16px;
	}

	.save-btn {
		flex: 2;
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
		.save-btn:hover {
			background-color: var(--paper);
			color: var(--primary);
		}
	}

	.delete-btn {
		flex: 1;
		padding: var(--block-pad);
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--danger);
		background-color: var(--danger);
		color: var(--paper);
		font-size: var(--text-base);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
		touch-action: manipulation;
		font-family: inherit;
	}

	@media (hover: hover) {
		.delete-btn:hover {
			background-color: var(--paper);
			color: var(--danger);
		}
	}

	.skip-btn {
		width: 100%;
		padding: var(--block-pad);
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		background-color: transparent;
		color: var(--primary);
		font-size: var(--text-base);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
		margin-top: 8px;
		touch-action: manipulation;
		font-family: inherit;
	}

	@media (hover: hover) {
		.skip-btn:hover {
			background-color: var(--primary-a08);
			opacity: 1;
		}
	}

	.all-done-msg {
		text-align: center;
		color: var(--primary);
		font-style: italic;
		padding: 16px 0;
		font-size: var(--text-base);
	}
</style>

{#if chore}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions (Escape closes the panel) -->
	<section
		class="panel"
		aria-label="{chore.name}"
		tabindex="-1"
		bind:this={panelEl}
		on:keydown={(e) => e.key === 'Escape' && reset()}
	>
		<div class="panel-head">
			<SelectButtons
				hooks={{ "Sign": () => switchMode(false), "Edit": () => switchMode(true) }}
				selected_value={editMode ? 1 : 0}
			/>
			<button type="button" class="close-btn" aria-label="Close" on:click={reset}>×</button>
		</div>

			<h2 class="chore-title">{chore.name}</h2>

			{#if !editMode}
				<p class="helper">Signing as:</p>
				<SelectButtons
					justify="start"
					selected_value={users.findIndex(u => u._id == chore.who)}
					hooks={Object.fromEntries(users.map(u => [u.name, () => { chore.who = u._id; }]))}
				/>

				<hr class="divider" />

				{#if chore.notes}
					<div class="notes-box on-primary">
						<p class="notes-text prose">{chore.notes}</p>
					</div>
				{/if}

				{#if allDone}
					<p class="all-done-msg">All rooms already completed this cycle.</p>
				{:else}
					<p class="helper">Tap to deselect rooms you didn't do:</p>
					<div class="chips-grid">
						{#each chore.rooms as room}
							{#if room.done}
								<button type="button" class="room-chip already-done" disabled>
									{room.name}
								</button>
							{:else}
								<button
									type="button"
									class="room-chip {roomsChecked.includes(room._id) ? 'selected' : 'unselected'}"
									aria-pressed={roomsChecked.includes(room._id)}
									on:click={() => toggleSignRoom(room._id)}
								>
									{room.name}
								</button>
							{/if}
						{/each}
					</div>

					<hr class="divider" />

					<div class="stats-row">
						<button
							type="button"
							class="stats-btn {chore.stats ? 'on' : 'off'}"
							aria-pressed={!!chore.stats}
							on:click={() => { chore.stats = !chore.stats; }}
						>
							Stats {chore.stats ? 'on' : 'off'}
						</button>
						<span class="helper" style="margin: 0;">Record in statistics</span>
					</div>

					<button
						class="sign-btn"
						disabled={roomsChecked.length === 0}
						on:click={submit}
					>
						{roomsChecked.length === 0
							? 'Select rooms to sign'
							: `Sign ${roomsChecked.length} room${roomsChecked.length !== 1 ? 's' : ''}`}
					</button>
					<button class="skip-btn" on:click={skip}>Skip</button>
				{/if}

			{:else}
				<Section title="Name" />
				<input
					type="text"
					class="edit-input"
					bind:value={chore.name}
					placeholder="Chore name"
				/>

				<Section title="Notes" />
				<textarea
					class="edit-input"
					bind:value={chore.notes}
					placeholder="Optional notes..."
				></textarea>

				<Section title="Repeat" />
				<div class="repeat-row">
					<input
						type="number"
						class="repeat-num"
						min="1"
						max={repeatUnit === 'days' ? 30 : 12}
						bind:value={repeatNum}
					/>
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
				</div>
				<p class="helper">Repeats {formatRepetition()}</p>

				<Section title="Rooms" />
				{#if all_rooms.length}
					<div class="chips-grid" style="margin-bottom: 8px;">
						{#each all_rooms as room}
							<button
								type="button"
								class="room-chip {newRooms.includes(room._id) ? 'selected' : 'unselected'}"
								aria-pressed={newRooms.includes(room._id)}
								on:click={() => toggleEditRoom(room._id)}
							>
								{room.name}
							</button>
						{/each}
					</div>
				{:else}
					<p class="helper">Loading rooms...</p>
				{/if}

				<div class="action-row">
					<button class="save-btn" on:click={update}>Save changes</button>
					<button
						class="delete-btn"
						on:click={() => {
							if (confirm(`Delete "${chore.name}"? This removes all statistics and cannot be undone.`)) {
								delFunc(chore._id);
							}
						}}
					>Delete</button>
				</div>
			{/if}
	</section>
{/if}
