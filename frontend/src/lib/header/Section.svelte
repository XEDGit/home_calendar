<script>
	export let title = '';
	export let subtitle = '';
	export let color = '#96616B'
	export let subcolor = '#96616B'
	export let icon = ''
	export let onClick = () => {};
</script>

<style>
	div {
		display: flex;
		flex-direction: column;
		align-items: baseline;
	}

	img {
		height: 20px;
	}

	h5 {
		margin: 0;
		color: gray;
		font-weight: normal;
		font-style: italic;
	}

	h2, hr {
		margin: 0;
		color: var(--color);
	}

	hr {
		width: 100%;
		border: 1px solid var(--color);
		margin-bottom: 3vh;
	}
	
	h2 {
		margin-top: 0.5vh;
		margin-bottom: 0.5vh;
		text-align: left;
	}
</style>

<div style="--color: {color};" on:click={onClick}>
	<div style="flex-direction: row; gap: 5px;">
		{#if icon}
			<img src={icon} />
		{/if}
		<h2>{title}</h2>
		{#if subtitle}
			<h5 style="color: {subcolor};">{subtitle}</h5>
		{/if}
	</div>
	<hr />
</div>