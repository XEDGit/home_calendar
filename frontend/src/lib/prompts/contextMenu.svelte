<script>
	export let functions;
</script>

<style>
	.menu-popup {
		position: absolute;
		top: 80%;
		border: var(--bw) solid var(--primary);
		width: 20%;
		margin-bottom: var(--space-sm);
		box-shadow: var(--shadow-pop);
		z-index: 1000;
		display: block;
	}

	.trashcan-button {
        background: none;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center; /* Aligns items vertically */
        padding: 8px;
    }

	.trashcan-icon {
        width: 24px;
        height: 24px;
        fill: var(--danger);
        margin-right: 8px; /* Space between icon and text */
    }
</style>

<div class="menu-popup info-card retro-white" role="presentation" on:click={(e) => {e.stopPropagation()}}>
	<button class="trashcan-button" on:click={() => {functions.delete(functions.id)}}>
		<svg class="trashcan-icon" width="20" height="20" viewBox="0 0 24 24">
			<path d="M3 6h18v2H3zm2 3h14v14H5zm2 2h10v10H7z" />
		</svg><p>Delete</p>
	</button>
</div>
