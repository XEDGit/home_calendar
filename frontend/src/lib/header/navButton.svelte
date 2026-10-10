<script>
	export let active = 1;
    export let f, buttons = [];
	export let disableMask = Array(buttons.length).fill(false);
	// Count bubbles per button label, e.g. { assistant: 2 }; 0 hides it
	export let badges = {};

	$: count = Object.keys(buttons).length;
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
		padding-bottom: var(--space-sm);
	}

	/* One rose bar, lined up with the content column below; the tabs are its
	 * segments and the active one is a paper pill. Equal columns, and a
	 * column only grows past its share when its label needs the room. Inner
	 * corners follow the outer ones (10px bar - 5px inset = 5px). */
	.navBar {
		box-sizing: border-box;
		width: 95%;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		gap: var(--space-xs);
		padding: var(--space-xs);
		border-radius: var(--radius-lg);
		background-color: var(--primary);
	}

	.navButton {
		height: 2.5rem;
		padding: 0 var(--space-sm);
		border: var(--bw) solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
		white-space: nowrap;
		background-color: transparent;
		color: var(--paper);
		transition: var(--swap);
	}

	.active {
		background-color: var(--paper);
		color: var(--primary);
	}

	.navButton:disabled {
		background-color: var(--idle);
		color: var(--paper);
	}

	/* Inside the bar a full inversion would read as the active tab, so a
	 * hovered segment takes a paper wash instead and keeps its solid label */
	@media (hover: hover) {
		.navButton:not(:disabled):not(.active):hover {
			background-color: var(--paper-a12);
		}
	}

	/* Segments have no visible edge to hang the badge from, so it rides on
	 * the label's top-right, with a rose ring to stand off the pill */
	.label {
		position: relative;
	}

	.badge {
		position: absolute;
		top: -9px;
		left: calc(100% + 1px);
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		box-sizing: border-box;
		border-radius: var(--radius-pill);
		background: var(--urgent);
		box-shadow: 0 0 0 var(--bw) var(--primary);
		color: var(--paper);
		font-size: var(--text-xs);
		line-height: 18px;
		text-align: center;
	}

	/* Below this the labels don't fit one row, so the nav is two rows.
	 * Labels stay whole (no clipping or ellipsis). */
	@media (max-width: 899px) {
		.navBar {
			grid-auto-flow: row;
			grid-template-columns: repeat(var(--half), 1fr);
		}
	}

	/* 10px corners - 3px inset = 7px */
	@media (max-width: 639px) {
		.navBar {
			gap: 3px;
			padding: 3px;
		}

		.navButton {
			padding: 0 3px;
			border-radius: var(--radius-md);
			font-size: var(--text-xs);
		}
	}
</style>

<div class='navBackground'>
    <nav class="navBar on-primary" style:--half={Math.ceil(count / 2)} aria-label="Sections">
		{#each Object.entries(buttons).map((button, index) => [button, disableMask[index]]) as [button, masked]}
	        <button disabled={masked} class="navButton {active == button[1]? 'active' : ''}" aria-current={active == button[1] ? 'page' : undefined} on:click={() => f(button[1])}><span class="label">{button[0]}{#if badges[button[0]]}<span class="badge" aria-label={`${badges[button[0]]} unread`}>{badges[button[0]]}</span>{/if}</span></button>
		{/each}
    </nav>
</div>
