<script>
	export let active = 1;
    export let f, buttons = [];
	export let disableMask = Array(buttons.length).fill(false);
	// Count bubbles per button label, e.g. { assistant: 2 }; 0 hides it
	export let badges = {};
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

	.navButton { position: relative; }

	.badge {
		position: absolute;
		top: -6px;
		right: -6px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		box-sizing: border-box;
		border-radius: var(--radius-pill);
		background: var(--urgent);
		color: var(--paper);
		font-size: var(--text-xs);
		line-height: 18px;
		text-align: center;
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

	/* Phones: eight labels don't fit one row, so the nav is two rows of four.
	 * Labels stay whole (no clipping or ellipsis), which also leaves room for
	 * the badge that hangs off a button's corner. */
	@media (max-width: 639px) {
		.navBar {
			box-sizing: border-box;
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 3px;
			padding: 0 4px var(--space-sm);
		}

		.navButton {
			height: 2.5rem;
			padding: 0 3px;
			font-size: var(--text-xs);
			white-space: nowrap;
		}
	}
</style>

<div class='navBackground'>
    <nav class="navBar" aria-label="Sections">
		{#each Object.entries(buttons).map((button, index) => [button, disableMask[index]]) as [button, masked]}
	        <button disabled={masked} class="navButton {active == button[1]? 'active' : ''}" aria-current={active == button[1] ? 'page' : undefined} on:click={() => f(button[1])}>{button[0]}{#if badges[button[0]]}<span class="badge" aria-label={`${badges[button[0]]} unread`}>{badges[button[0]]}</span>{/if}</button>
		{/each}
    </nav>
</div>