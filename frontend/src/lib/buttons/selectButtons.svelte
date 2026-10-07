<script>
	export let selected_value = 0;
	export let hooks = {
		"Example": () => {selected_value = 0;},
		"Other example": () => {selected_value = 1;},
	};
	export let justify = 'center';
</script>

<style>
	/* Buttons wrap onto a second line as whole buttons (long member names
	 * on a phone), never pushing past the edge or breaking a name */
	.select-mode {
		display: flex;
		flex-wrap: wrap;
		width: 100%;
		margin-bottom: var(--space-xs);
		gap: var(--space-sm);
	}

	.mode-button {
		background-color: var(--paper);
		border-radius: var(--radius-md);
		color: var(--primary);
		border: var(--bw) solid var(--primary);
		padding: var(--control-pad-y) var(--control-pad-x);
		min-height: var(--control-min-h);
		font-weight: var(--weight-bold);
		font-family: inherit;
		white-space: nowrap;
		cursor: pointer;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.mode-button:hover {
			background-color: var(--primary);
			color: var(--paper);
		}
	}

	.active {
		color: var(--paper);
		background-color: var(--primary);
	}
</style>

<div class="select-mode" style='justify-content: {justify};'>
	{#each Object.entries(hooks) as button, idx}
		<button class={'mode-button ' + (idx == selected_value? 'active' : '')} on:click={() => {selected_value = idx; button[1]()}}>{button[0]}</button>
	{/each}
</div>