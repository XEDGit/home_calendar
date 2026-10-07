<script>
	export let active = 1;
    export let f, buttons = [];
	export let disableMask = Array(buttons.length).fill(false);
</script>

<style>
	button::first-letter {
		text-transform: uppercase;
	}

	.navBackground {
		display:flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.navButton {
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		flex-grow: 0.15;
		height: 3rem;
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
		background-color: var(--primary);
		color: var(--paper);
		justify-content: center;
		transition: var(--swap);
	}

	.navButton:disabled {
		border-color: var(--idle);
		background-color: var(--idle);
		box-shadow: none;
		color: var(--paper);
	}

	@media (hover: hover) {
		.navButton:disabled:hover {
			border-color: var(--idle);
			background-color: var(--idle);
			box-shadow: none;
			color: var(--paper);
		}

		.navButton:hover {
			background-color: var(--paper);
			color: var(--primary);
			box-shadow: var(--shadow-lift);
		}
	}

	.navBar {
		width: 100%;
		align-content: center;
		justify-content: space-evenly;
		background-color: var(--paper);
		display: flex;
		padding-bottom: var(--space-sm);
	}

	.active {
		background-color: var(--paper);
		color: var(--primary);
	}

	/* Phones: one step down, not fluid. The seven labels share the row by
	 * their length and never break inside a word. */
	@media (max-width: 480px) {
		.navBar {
			box-sizing: border-box;
			gap: 3px;
			padding: 0 4px var(--space-sm);
		}

		.navButton {
			flex: 1 1 auto;
			min-width: 0;
			padding: 0 3px;
			font-size: var(--text-xs);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}

	/* Under 360px (small phones, or zoomed text) seven can't fit a row, so the
	 * nav becomes two rows of four instead of running off the edge */
	@media (max-width: 359px) {
		.navBar {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
		}

		.navButton {
			height: 2.5rem;
		}
	}
</style>

<div class='navBackground'>
    <nav class="navBar" aria-label="Sections">
		{#each Object.entries(buttons).map((button, index) => [button, disableMask[index]]) as [button, masked]}
	        <button disabled={masked} class="navButton {active == button[1]? 'active' : ''}" aria-current={active == button[1] ? 'page' : undefined} on:click={() => f(button[1])}>{button[0]}</button>
		{/each}
    </nav>
</div>