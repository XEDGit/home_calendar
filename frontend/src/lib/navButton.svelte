<script>
    export let f, buttons;
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
		padding: 0 2vw;
		min-height: 40px;
		font-weight: bold;
		font-size: clamp(12px, 2vw, 32px);
		background-color: #96616B;
		color: #FFEAD0;
		justify-content: center;
	}

	.navButton:hover {
		background-color: #FFEAD0;
		color: #96616B;
		box-shadow: 0 7px 15px rgba(0, 0, 0, 0.3);
	}

	.navBar {
		max-height: 40px;
		width: 100%;
		align-content: center;
		justify-content: center;
		background-color: #FFEAD0;
		display: flex;
		gap: 5px;
		padding-bottom: 10px;
	}

</style>

<div class='navBackground'>
    <div class="navBar">
		{#each Object.entries(buttons) as button}
	        <button class="navButton" on:click={() => {f(button[1])}}>{button[0]}</button>
		{/each}
    </div>
</div>