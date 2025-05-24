<script>
    export let func;
</script>

<style>
	button {
		height: clamp(50px, 10vh, 80px);
		width: clamp(50px, 10vh, 80px);
		cursor: pointer;
		padding: 5px;
		align-content: center;
		font-size: clamp(20px, 5vh, 80px);
		background-color: #FFEAD0;
		color: #96616B;
		border: 3px solid #96616B;
		border-radius: 50%;
		position: fixed;
		bottom: 5vh;
		right: 40px;
	}

	button:hover {
		background-color: #96616B;
		color: #FFEAD0;
	}
</style>

<div>
    <button on:click={func}>+</button>
</div>