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
		border: 3px solid #96616B;
		border-radius: 5px;
		cursor: pointer;
		flex-grow: 0.15;
		height: 3rem;
		font-weight: bold;
		font-size: clamp(12px, 2vw, 32px);
		background-color: #96616B;
		color: #FFEAD0;
		justify-content: center;
	}

	.navButton:disabled, .navButton:disabled:hover {
		border: gray;
		background-color: gray;
		box-shadow: none;
		color: #FFEAD0;
	}

	.navButton:hover {
		background-color: #FFEAD0;
		color: #96616B;
		box-shadow: 0 7px 15px rgba(0, 0, 0, 0.3);
	}

	.navBar {
		width: 100%;
		align-content: center;
		justify-content: space-evenly;
		background-color: #FFEAD0;
		display: flex;
		padding-bottom: 10px;
	}

	.active {
		background-color: #FFEAD0;
		color: #96616B;
	}
</style>

<div class='navBackground'>
    <div class="navBar">
		{#each Object.entries(buttons).map((button, index) => [button, disableMask[index]]) as [button, masked]}
	        <button disabled={masked} class="navButton {active == button[1]? 'active' : ''}" on:click={() => {active = button[1]; f(button[1])}}>{button[0]}</button>
		{/each}
    </div>
</div>