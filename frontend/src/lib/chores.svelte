<script>
	export let chores;
</script>

{#each chores as chore}
<div class='choreContainer' style="
	width: 90%;
	margin: 0 auto;
	display: flex;
	flex-direction: column;
	align-items: center;">
	<div style="width: 90%; height: 10vh; border-radius: 5px;; background-color: #D0A7EB; margin-bottom: 10px; align-content: center;">
		<div style="float:left; padding-left: 10px">
			<p>{chore.name}</p>
		</div>
		<div style="float:right; display: flex; flex-direction: row-reverse; gap: 10%; padding-right: 10px">
			<p>{chore.nextTime}</p>
			{#each chore.rooms as room}
				<p>{room}</p>
			{/each}
		</div>
	</div>
</div>
{/each}
