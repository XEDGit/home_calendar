<script>
	export let title = '';
	export let subtitle = '';
	export let color = 'var(--primary)'
	export let subcolor = 'var(--primary)'
	export let icon = ''
</script>

<style>
	div {
		display: flex;
		flex-direction: column;
		align-items: baseline;
	}

	/* Title and subtitle share a line when they fit. When they don't, the
	 * subtitle drops below the title; words themselves never split. */
	.heading {
		flex-direction: row;
		flex-wrap: wrap;
		column-gap: 5px;
		max-width: 100%;
	}

	img {
		height: 20px;
	}

	h5 {
		margin: 0;
		color: var(--primary);
		font-weight: var(--weight-regular);
		font-style: italic;
	}

	h2, hr {
		margin: 0;
		color: var(--color);
	}

	hr {
		box-sizing: border-box;
		width: 100%;
		border: var(--bw-hair) solid var(--color);
		margin-bottom: 3vh;
	}

	/* min-width: 0 lets a word longer than the whole line break instead of
	 * overflowing; shorter words always wrap whole */
	h2 {
		margin-top: 0.5vh;
		margin-bottom: 0.5vh;
		text-align: left;
		min-width: 0;
		overflow-wrap: break-word;
	}
</style>

<div style="--color: {color};">
	<div class="heading">
		{#if icon}
			<img src={icon} alt="" />
		{/if}
		<h2>{title}</h2>
		{#if subtitle}
			<h5 style="color: {subcolor};">{subtitle}</h5>
		{/if}
	</div>
	<hr />
</div>
