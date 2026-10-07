<script>
	import AutomationForm from './automationForm.svelte';
	import { addAutomation } from '$lib/requests.js';

	async function save(data) {
		const res = await addAutomation(data);
		if (res?.error) return res.error;
		window.history.back();
		return null;
	}
</script>

<div style="max-width: 640px; width: 100%;">
	<AutomationForm submitText="Add automation" onSubmit={save} />
</div>
