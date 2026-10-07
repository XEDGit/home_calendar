<script>
	import { tick } from 'svelte';
	import { modalDialog, closeDialog, morphHeight } from '$lib/motion';
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
	
	// Repetition options
	const repetitionOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'daily', label: 'Daily' },
		{ value: 'weekly', label: 'Weekly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'yearly', label: 'Yearly' }
	];
	
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
			...event,
			repetition: event.repetition || 'none' // Default to 'none' if not set
		};
		eventDateTime = event.when;
	}
	
	function reset() {
		onClose();
	}
	
	async function updateEvent() {
		try {
			const updatedEvent = {
				...editedEvent,
				when: eventDateTime
			};
			console.log(event.when);
			const result = await postFrontend('updateEvent', updatedEvent);
			if (result.success) {
				onUpdated(result.event);
				closeDialog(dialogEl);
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
					closeDialog(dialogEl);
				} else {
					alert('Failed to delete event: ' + result.message);
				}
			} catch (error) {
				console.error('Error deleting event:', error);
				alert('Failed to delete event');
			}
		}
	}
	

	// Native modal dialog; modalDialog animates it in and out
	let dialogEl;

	// View ↔ edit changes the dialog's height: morph it instead of jumping
	async function switchMode(next) {
		if (editMode === next) return;
		const settle = morphHeight(dialogEl);
		editMode = next;
		await tick();
		settle();
	}
</script>
<style>
	/* Native <dialog>: top layer, focus trap, Escape and inert background come free */
	.modal-content {
		border: none;
		margin: auto;
	}

	dialog.modal-content {
		padding-top: calc(44px + var(--space-md));
	}

	.modal-content:not([open]) {
		display: none;
	}

	.close-btn {
		position: absolute;
		top: var(--space-sm);
		right: var(--space-sm);
		width: 44px;
		height: 44px;
		padding: 0;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-circle);
		background: var(--paper);
		color: var(--primary);
		font: inherit;
		font-size: var(--text-lg);
		font-weight: var(--weight-bold);
		line-height: 1;
		cursor: pointer;
		transition: var(--swap);
	}

	@media (hover: hover) {
		.close-btn:hover {
			background: var(--primary);
			color: var(--paper);
		}
	}

	div {
		box-sizing: border-box;
	}
	.modal-content {
		background: var(--paper);
		color: var(--primary);
		cursor: default;
		padding: 2%;
		border-radius: var(--radius-lg);
		width: 70%;
		max-height: 90%;
		overflow-x: hidden;
		overflow-y: auto;
		display: flex;
        align-items: flex-start;
		flex-direction: column;
		box-shadow: var(--shadow-modal);
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
		color: var(--primary);
		font-weight: var(--weight-bold);
	}
	
	input, textarea {
		box-sizing: border-box;
		width: 100%;
		padding: 8px;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		background: var(--paper);
		color: var(--primary);
		-webkit-appearance: none; /* Fix Safari input styling */
	}
	
	.button-row {
		display: flex;
		justify-content: space-between;
		width: 100%;
		margin-top: 20px;
	}
	
	button {
		padding: var(--block-pad);
		border-radius: var(--radius-md);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
		-webkit-appearance: none; /* Fix Safari button styling */
	}

	#repetition {
		box-sizing: border-box;
		width: 100%;
		padding: 8px;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		background: var(--paper);
		color: var(--primary);
	}
	
	.save-btn {
		background: var(--primary);
		color: var(--paper);
		border: var(--bw) solid var(--primary);
	}
	
	@media (hover: hover) {
		.save-btn:hover {
			background: var(--paper);
			color: var(--primary);
		}
	}
	
	.delete-btn {
		background: var(--danger);
		color: var(--paper);
		border: var(--bw) solid var(--danger);
	}
	
	@media (hover: hover) {
		.delete-btn:hover {
			background: var(--paper);
			color: var(--danger);
		}
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
		font-weight: var(--weight-bold);
		color: var(--primary);
	}
	
	.detail-value {
		flex: 1;
		color: var(--primary);
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
			font-size: var(--text-md) !important;
		}
	}
</style>
{#if event}
	<dialog class="dialog modal-content" aria-label={event.title} bind:this={dialogEl} use:modalDialog on:close={() => reset()}>
		<button type="button" class="close-btn" aria-label="Close" on:click={() => closeDialog(dialogEl)}>×</button>
            <div class="modal-layout">
			<SelectButtons hooks={{"View": () => switchMode(false), "Edit": () => switchMode(true)}} />
			
			<h1 style="color: var(--primary); margin: 0; width: 100%; font-weight: var(--weight-bold); font-size: var(--text-lg); padding: 10px 0;">
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
							<div class="detail-value prose">{event.description}</div>
						</div>
					{/if}
					{#if event.repeatDays !== undefined}
						<div class="detail-row">
							<div class="detail-label">Repetition:</div>
							<div class="detail-value">
								{#if event.repeatDays === 0}
									None
								{:else if event.repeatDays === 1}
									Daily
								{:else if event.repeatDays === 7}
									Weekly
								{:else if event.repeatDays === 30}
									Monthly
								{:else if event.repeatDays === 365}
									Yearly
								{:else}
									Every {event.repeatDays} days
								{/if}
							</div>
						</div>
					{/if}
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
				
				<div class="form-group">
					<label for="repetition">Repetition</label>
					<select id="repetition" bind:value={editedEvent.repetition}>
						{#each repetitionOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</div>
				
				<div class="button-row">
					<button class="save-btn" on:click={updateEvent}>Save Changes</button>
					<button class="delete-btn" on:click={deleteEvent}>Delete</button>
				</div>
                {/if}
            </div>
	</dialog>
{/if}
