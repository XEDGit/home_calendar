<script>	
	export let dragData;
	let startX = 0;
	let currentX = 0;
	let offsetX = 0;
	let isDragging = false;
	    
	const handleDragStart = (event) => {
		isDragging = true;
		startX = event.touches ? event.touches[0].clientX : event.clientX;
	};

	const handleDragMove = (event) => {
		if (!isDragging) return;
		const newX = (event.touches ? event.touches[0].clientX : event.clientX) - startX + offsetX;
		if (newX > 100) {
			currentX = newX
		}
	};

	const handleDragEnd = () => {
		isDragging = false;

		if (currentX > 250) {
			isDragging = false;
			currentX = 0; 
			dragData.sign(dragData.id)
		} else {
			isDragging = false;
			currentX = 0; 
		}
		offsetX = currentX; 
	};
</script>

<div class='info-card no-select'
	aria="slide-card"
	aria-valuenow={currentX}
    aria-valuemin="0"
    aria-valuemax="400"
	tabindex="0"
	role='slider'
	on:touchstart={handleDragStart}
	on:touchmove={handleDragMove}
	on:touchend={handleDragEnd}
	style="transform: translateX({currentX}px);"
>
<slot></slot>
</div>

<style>
	.no-select {
		user-select: none;
		-webkit-user-select: none;
		-ms-user-select: none;
	}

	.info-card {
		width: 100%;
		height: 10vh;
		min-height: 60px;
		border-radius: 5px;
		background-color: #96616B;
		margin-bottom: 10px;
		align-content: center;
		justify-content: space-between;
		display: flex;
		font-size: 20px;
	}
	@media (max-width: 1100px) {
		.info-card {
			font-size: 18px;
		}
	}
</style>
