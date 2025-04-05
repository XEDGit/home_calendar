<script>
	import Form from "$lib/prompts/form.svelte";
</script>

<style>
	.modal {
		display: flex;
		justify-content: center;
		align-content: center;
	}
</style>

<div class="modal">
	<Form
		inputs={{
			title: 'text',
			when: 'date',
			where: 'text',
		}}
		required_mask={[
			true,
			true,
			false,
		]}
		endpoint='addEvent'
	></Form>
</div>