<script>
	export let
		func = (v) => {console.error('Button with no functionality')},
		title = 'Button',
		active = false,
		inverted = false;
	export let
		value = title;
</script>

<style>
	button {
		padding: var(--chip-pad-y) var(--chip-pad-x);
		border-radius: var(--radius-pill);
		border: var(--bw) solid var(--primary);
		font-weight: var(--weight-bold);
		font-family: inherit;
		cursor: pointer;
		touch-action: manipulation;
		transition: var(--swap);
	}

	@media (hover: hover) {
		button:hover {
			text-decoration: underline;
		}
	}

	.inverted {
		background-color: var(--paper);
		color: var(--primary);
	}

	.standard {
		background-color: var(--primary);
		color: var(--paper);
	}

	.active-inverted {
		background-color: var(--primary);
		color: var(--paper);
	}

	.active {
		background-color: var(--paper);
		color: var(--primary);
	}
</style>

<button class={(active? 'active' : '') + (inverted? '-inverted' : '') + ' ' + (inverted? 'inverted' : 'standard')} on:click={() => {func(value)}}>{title}</button>
