<script>
	export let onSubmit = () => {};  // This is the function that will be called when the user submits

	export let buttons = null
</script>
  
<style>
	.modal {
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		justify-content: center;
		align-items: center;
	}
  
	.modal-content {
		background: #FFEAD0;
		padding: 20px;
		border-radius: 8px;
		width: 300px;
		text-align: center;
	}

	.userButtons {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
</style>

{#if (buttons)}

<div class="modal">
	<div class="modal-content">
		<h3>Who are you?</h3>
		<div class='userButtons'>
			{#each buttons as button}
			<button class='navButton' on:click={() => onSubmit(button._id)}>{button.name}</button>
			{/each}
		</div>
	</div>
</div>

{/if}