<script>
	export let onSubmit = () => {};

	export let buttons = null
</script>

<style>
	.navButton {
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		cursor: pointer;
		padding: var(--block-pad);
		min-height: 60px;
		font-weight: var(--weight-bold);
		font-size: var(--text-base);
		background-color: var(--primary);
		color: var(--paper);
		justify-content: center;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.navButton:hover {
			background-color: var(--paper);
			color: var(--primary);
			box-shadow: var(--shadow-lift);
		}
	}

	.modal {
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: var(--overlay);
		justify-content: center;
		align-items: center;
	}

	.modal-content {
		background: var(--paper);
		padding: var(--space-lg);
		border-radius: var(--radius-lg);
		width: 300px;
		max-width: 100%;
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