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
		padding: 5px 10px;
		border-radius: 10px;
		border: solid 2px #96616B;
		touch-action: manipulation;
	}

	button:hover {
		text-decoration: underline;
	}

	.inverted {
		background-color: #FFEAD0;
		color: #96616B;
	}

	.standard {
		background-color: #96616B;
		color: #FFEAD0;
	}

	.active-inverted {
		background-color: #96616B;
		color: #FFEAD0;
	}

	.active {
		background-color: #FFEAD0;
		color: #96616B;
	}
</style>

<button class={(active? 'active' : '') + (inverted? '-inverted' : '') + ' ' + (inverted? 'inverted' : 'standard')} on:click={() => {func(value)}}>{title}</button>
