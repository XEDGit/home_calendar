<script>
	import SelectButtons from '$lib/buttons/selectButtons.svelte';
	import { postFrontend } from '$lib/requests';
	import DateTimePicker from '$lib/inputs/DateTimePicker.svelte';
	export let event = null;
	
	// Use callback props instead of event dispatcher
	export let onClose = () => {};
	export let onUpdated = () => {};
	export let onDeleted = () => {};
	
	let editMode = false;
	let editedEvent = null;
	let eventDateTime = '';
	
	// Format functions for displaying date and time
	function formatDate(dateString) {
		const date = new Date(dateString);
		const day = date.getDate().toString().padStart(2, '0');
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	}
	
	function formatTime(dateString) {
		const date = new Date(dateString);
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		return `${hours}:${minutes}`;
	}
	
	$: if (event) {
		editedEvent = {
			...event
		};
		eventDateTime = event.when;
	}
	
	function reset() {
		onClose();
	}
	
	function handleDateTimeChange(e) {
		eventDateTime = e.detail.datetime;
	}
	
	async function updateEvent() {
		try {
			const updatedEvent = {
				...editedEvent,
				when: eventDateTime
			};
			
			const result = await postFrontend('updateEvent', updatedEvent);
			if (result.success) {
				onUpdated(result.event);
				reset();
			} else {
				alert('Failed to update event: ' + result.message);
			}
		} catch (error) {
			console.error('Error updating event:', error);
			alert('Failed to update event');
		}
	}
	
	async function deleteEvent() {
		if (confirm('Are you sure you want to delete this event?')) {
			try {
				const result = await postFrontend('deleteEvent', { id: event._id });
				if (result.success) {
					onDeleted(event._id);
					reset();
				} else {
					alert('Failed to delete event: ' + result.message);
				}
			} catch (error) {
				console.error('Error deleting event:', error);
				alert('Failed to delete event');
			}
		}
	}
	
	// Handle escape key for Safari and other browsers
	function handleKeydown(event) {
		if (event.key === 'Escape') {
			reset();
		}
	}
</script>
<style>
	.modal {
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		z-index: 100; /* Higher z-index to ensure it's above all other elements */
		-webkit-backdrop-filter: blur(2px); /* Safari blur effect */
		backdrop-filter: blur(2px);
	}
	div {
		box-sizing: border-box;
	}
	.modal-content {
		background: #FFEAD0;
		cursor: default;
		padding: 2%;
		border-radius: 10px;
		width: 70%;
		max-height: 90%;
		overflow-x: hidden;
		overflow-y: auto;
		display: flex;
        align-items: flex-start;
		flex-direction: column;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); /* More defined shadow for better visual hierarchy */
		-webkit-overflow-scrolling: touch; /* Smooth scrolling for Safari */
	}
    .modal-layout {
        width: 98%;
    }
	
	.form-group {
		width: 100%;
		margin-bottom: 15px;
	}
	
	label {
		display: block;
		margin-bottom: 5px;
		color: #96616B;
		font-weight: bold;
	}
	
	input, textarea {
		width: 100%;
		padding: 8px;
		border: 1px solid #96616B;
		border-radius: 4px;
		background: #FFF8E8;
		color: #96616B;
		-webkit-appearance: none; /* Fix Safari input styling */
	}
	
	.button-row {
		display: flex;
		justify-content: space-between;
		width: 100%;
		margin-top: 20px;
	}
	
	button {
		padding: 8px 16px;
		border-radius: 4px;
		font-weight: bold;
		cursor: pointer;
		border: none;
		-webkit-appearance: none; /* Fix Safari button styling */
	}
	
	.save-btn {
		background: #96616B;
		color: #FFEAD0;
	}
	
	.save-btn:hover {
		background-color: #7a4e56;
	}
	
	.delete-btn {
		background: #d9534f;
		color: #FFEAD0;
	}
	
	.delete-btn:hover {
		background: #c9302c;
	}
	
	.event-details {
		width: 100%;
	}
	
	.detail-row {
		display: flex;
		margin-bottom: 10px;
	}
	
	.detail-label {
		width: 100px;
		font-weight: bold;
		color: #96616B;
	}
	
	.detail-value {
		flex: 1;
		color: #333;
	}
	
	h1 {
		width: 100%;
		text-align: center;
		margin-bottom: 15px;
	}
	
	/* Safari-specific fixes */
	@supports (-webkit-touch-callout: none) {
		.button-row {
			display: -webkit-box;
			display: -webkit-flex;
			display: flex;
		}
		
		.detail-row {
			display: -webkit-box;
			display: -webkit-flex;
			display: flex;
		}
	}
	
	@media (max-width: 768px) {
		.modal-content {
			width: 90%;
			padding: 15px 10px;
		}
		
		.button-row {
			flex-direction: column;
			gap: 10px;
		}
		
		button {
			width: 100%;
			padding: 10px;
			margin: 0;
		}
		
		.detail-row {
			flex-direction: column;
			margin-bottom: 15px;
		}
		
		.detail-label {
			width: 100%;
			margin-bottom: 3px;
		}
		
		.detail-value {
			padding-left: 5px;
		}
	}
	
	@media (max-width: 480px) {
		.modal-content {
			width: 95%;
			padding: 12px 8px;
		}
		
		input, textarea {
			padding: 6px;
		}
		
		h1 {
			font-size: 1.1em !important;
		}
	}
</style>
{#if event}
	<div class="modal" role="dialog" on:keydown={handleKeydown} tabindex="-1" on:click={(e) => {e.stopPropagation(); reset()}}>
		<div class="modal-content" on:click={(e) => {e.stopPropagation()}}>
            <div class="modal-layout">
			<SelectButtons hooks={{"View": () => {if (editMode) editMode = false;}, "Edit": () => {if (!editMode) editMode = true;}}} />
			
			<h1 style="color: #96616B; margin: 0; width: 100%; font-weight: bold; font-size: 1.2em; padding: 10px 0;">
				{event.title}
			</h1>
			
			{#if !editMode}
				<div class="event-details">
					<div class="detail-row">
						<div class="detail-label">Date:</div>
						<div class="detail-value">{formatDate(event.when)}</div>
					</div>
					<div class="detail-row">
						<div class="detail-label">Time:</div>
						<div class="detail-value">{formatTime(event.when)}</div>
					</div>
					{#if event.location}
						<div class="detail-row">
							<div class="detail-label">Location:</div>
							<div class="detail-value">{event.location}</div>
						</div>
					{/if}
					{#if event.description}
						<div class="detail-row">
							<div class="detail-label">Description:</div>
							<div class="detail-value">{event.description}</div>
						</div>
					{/if}
					<div class="button-row">
						<button class="delete-btn" on:click={deleteEvent}>Delete Event</button>
					</div>
				</div>
			{:else}
				<div class="form-group">
					<label for="title">Title</label>
					<input type="text" id="title" bind:value={editedEvent.title} />
				</div>
				
				<div class="form-group">
					<DateTimePicker 
						id="event-datetime" 
						bind:value={eventDateTime} 
						required={true}
						on:change={handleDateTimeChange}
					/>
				</div>
				
				<div class="form-group">
					<label for="location">Location (optional)</label>
					<input type="text" id="location" bind:value={editedEvent.location} />
				</div>
				
				<div class="form-group">
					<label for="description">Description (optional)</label>
					<textarea id="description" rows="3" bind:value={editedEvent.description}></textarea>
				</div>
				
				<div class="button-row">
					<button class="delete-btn" on:click={deleteEvent}>Delete</button>
					<button class="save-btn" on:click={updateEvent}>Save Changes</button>
				</div>
                {/if}
            </div>
		</div>
	</div>
{/if}