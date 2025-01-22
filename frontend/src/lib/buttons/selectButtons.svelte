<script>
	export let selected_value = 0;
	export let hooks = {
		"Example": () => {selected_value = 0;},
		"Other example": () => {selected_value = 1;},
	};
</script>

<style>
	.select-mode {
		display: flex;
		justify-content: center;
		width: 100%;
		margin-bottom: 5px;
		gap: 10px;
	}
	
	.mode-button {
		background-color: #FFEAD0;
		border-radius: 5px;
		color: #96616B;
		border: solid 3px #96616B;
		padding: 5px 10px;
	}

	.mode-button:hover {
		background-color: #96616B;
		color: #FFEAD0;
	}

	.active {
		color: #FFEAD0;
		background-color: #96616B;
	}
</style>

<div class="select-mode">
	{#each Object.entries(hooks) as button, idx}
		<button class={'mode-button ' + (idx == selected_value? 'active' : '')} on:click={() => {selected_value = idx; button[1]()}}>{button[0]}</button>
	{/each}
</div>