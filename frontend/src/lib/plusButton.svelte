<script>
    export let func;
</script>

<style>
	button {
		height: clamp(50px, 10vh, 80px);
		width: clamp(50px, 10vh, 80px);
		padding: 5px;
		align-content: center;
		font-size: clamp(20px, 5vh, 80px);
		background-color: #96616B;
		color: #FFEAD0;
		border: 3px solid #FFEAD0;
		border-radius: 50%;
		position: fixed;
		bottom: 25vh;
		right: 40px;
	}

	button:hover {
		background-color: #FFEAD0;
		border: 3px solid #FFEAD0;
		color: #96616B;
	}
</style>

<div>
    <button on:click={func}>+</button>
</div>