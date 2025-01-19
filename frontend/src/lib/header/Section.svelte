<script>
	export let title = '';
	export let color = '#96616B'
	export let onClick = () => {};
</script>

<style>
	div {
		display: flex;
		flex-direction: column;
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
	<h2>{title}</h2>
	<hr />
</div>