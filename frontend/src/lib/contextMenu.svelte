<script>
	export let functions;
	let isOpen = false;

	function toggleMenu() {
		isOpen = !isOpen;
	}

	function closeMenu(event) {
		if (!event.target.closest('.menu-container')) {
			isOpen = false;
		}
	}

	// Close menu on click outside
	window.addEventListener('click', closeMenu);
</script>

<style>
	.menu-container {
		height: 50%;
		position: relative;
		top: -10px;
		z-index: 10;
	}
	
	.menu-button {
		align-content: center;
		background: none;
		border: none;
		font-size: 44px;
		color: #FFEAD0;
		cursor: pointer;
		transition: all 0.5s;
	}

	.menu-button:hover {
		color: white;
		transform: scale(1.1);
	}

	.menu-popup {
		position: absolute;
		top: 100%;
		right: 0;
		background-color: white;
		border: 1px solid #ccc;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		margin-top: 5px;
		display: none;
	}

	.menu-popup.open {
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

<div class="menu-container">
	<button class="menu-button" aria-label="More options" on:click={toggleMenu}>...</button>
	<div class="menu-popup {isOpen ? 'open' : ''}">
		<button class="trashcan-button" on:click={() => {functions.delete(functions.id)}}>
			<svg class="trashcan-icon" width="20" height="20" viewBox="0 0 24 24">
				<path d="M3 6h18v2H3zm2 3h14v14H5zm2 2h10v10H7z" />
			</svg><p>Delete</p>
		</button>
	</div>
</div>
