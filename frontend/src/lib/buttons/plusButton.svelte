<script>
    export let func;
</script>

<style>
	button {
		height: clamp(50px, 10vh, 80px);
		width: clamp(50px, 10vh, 80px);
		cursor: pointer;
		padding: var(--space-xs);
		align-content: center;
		font-size: clamp(20px, 5vh, 80px);
		background-color: var(--paper);
		color: var(--primary);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-circle);
		position: fixed;
		bottom: 5vh;
		right: 40px;
		transition: var(--swap);
	}

	@media (hover: hover) {
		button:hover {
			background-color: var(--primary);
			color: var(--paper);
		}
	}
</style>

<div>
    <button class="fab" aria-label="Add" on:click={func}>+</button>
</div>