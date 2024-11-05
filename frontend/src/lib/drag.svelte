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
		if (currentX < startX) {
			startX = currentX;
			return;
		}
        currentX = (event.touches ? event.touches[0].clientX : event.clientX) - startX + offsetX;
    };

    const handleDragEnd = () => {
        isDragging = false;
        
        if (currentX > 250) {
            currentX = 400;
			dragData.sign(dragData.id)
        } else {
            currentX = 0; 
        }
        offsetX = currentX; 
    };
</script>

<div class='info-card'
	aria="slide-card"
    on:touchstart={handleDragStart}
    on:touchmove={handleDragMove}
    on:touchend={handleDragEnd}
    style="transform: translateX({currentX}px);"
>
<slot></slot>
</div>

<style>
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
