<script>
	export let functions;
</script>

<style>
	.menu-popup {
		position: absolute;
		top: 80%;
		border: 3px solid #96616B;
		width: 20%;
		margin-bottom: 10px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
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
        fill: #c71414;
        margin-right: 8px; /* Space between icon and text */
    }
</style>

<div class="menu-popup info-card retro-white" on:click={(e) => {e.stopPropagation()}}>
	<button class="trashcan-button" on:click={() => {functions.delete(functions.id)}}>
		<svg class="trashcan-icon" width="20" height="20" viewBox="0 0 24 24">
			<path d="M3 6h18v2H3zm2 3h14v14H5zm2 2h10v10H7z" />
		</svg><p>Delete</p>
	</button>
</div>
