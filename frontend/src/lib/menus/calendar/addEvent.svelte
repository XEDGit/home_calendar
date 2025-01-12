<script>
    import { addEvent } from "$lib/requests";

	let newEvent = {
		title: '',
		start: '',
		end: ''
	};

	let error = '';

	async function hookAddEvent() {
        try {
            const response = await addEvent(newEvent)
            if (!response.ok) {
                throw new Error('Failed to add event');
            }
            const createdEvent = await response.json();
            window.location = '/';
        } catch (err) {
            error = err.message;
        }
    }
</script>

<form on:submit|preventDefault={hookAddEvent}>
	<input type="text" bind:value={newEvent.title} placeholder="Event Title" required />
	<input type="datetime-local" bind:value={newEvent.start} required />
	<input type="datetime-local" bind:value={newEvent.end} required />
	<button type="submit">Add Event</button>
</form>