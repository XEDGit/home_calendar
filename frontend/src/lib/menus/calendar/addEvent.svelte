<script>
	import { postFrontend } from "$lib/requests";
	import DateTimePicker from "$lib/inputs/DateTimePicker.svelte";
	import { onMount } from "svelte";
	import { expand } from "$lib/motion";
	
	let newEvent = {
		title: '',
		when: new Date().toISOString(),
		location: '',
		description: '',
		repeatInterval: ''
	};
	let error = '';
	let success = false;
	
	// Initialize event date from localStorage if available
	onMount(() => {
		window.scrollTo(0, 0);
		
		// Check if we have a selected date in localStorage
		const storedDate = localStorage.getItem('selectedCalendarDate');
		if (storedDate) {
			try {
				// Parse the timestamp and set the event date
				const timestamp = parseInt(storedDate, 10);
				const selectedDate = new Date(timestamp);
				
				if (!isNaN(selectedDate.getTime())) {
					
					// Keep the time as current time but use the selected date
					const now = new Date();
					selectedDate.setHours(now.getHours());
					selectedDate.setMinutes(now.getMinutes());
					
					// Important: directly assign the ISO string to newEvent.when
					newEvent.when = selectedDate.toISOString();
					
					// Clear the stored date to avoid reusing it unintentionally later
					localStorage.removeItem('selectedCalendarDate');
				} else {
					console.error('Invalid date timestamp:', timestamp);
				}
			} catch (e) {
				console.error('Error parsing stored date:', e);
			}
		}
	});
	
	async function addEvent() {
		if (!newEvent.title) {
			error = 'Event title is required';
			setTimeout(() => { error = ''; }, 3000);
			return;
		}
		try {
			const response = await postFrontend('addEvent', newEvent);
			if (response.success || response.insertedId) {
				success = true;
				// Reset form after successful submission but preserve the selected date
				const currentDate = newEvent.when;
				newEvent = {
					title: '',
					when: currentDate, // Keep the selected date
					location: '',
					description: '',
					repeatInterval: ''
				};
				setTimeout(() => { 
					success = false;
					window.history.back();
				}, 1500);
			} else {
				error = 'Failed to add event';
				setTimeout(() => { error = ''; }, 3000);
			}
		} catch (err) {
			error = err.message || 'Failed to add event';
			setTimeout(() => { error = ''; }, 3000);
		}
	}
	
	function handleDateTimeChange(e) {
		newEvent.when = e.detail.datetime;
	}
</script>

<style>
	.modal {
		display: flex;
		flex-direction: column;
		margin: 0 15px;
	}
	
	.form-container {
		margin-top: var(--space-md);
		background-color: var(--primary);
		border-radius: var(--radius-lg);
		padding: 15px 20px;
		color: var(--paper);
	}
	
	.form-group {
		margin-bottom: 15px;
	}
	
	label {
		display: block;
		margin-bottom: 5px;
		font-weight: var(--weight-bold);
	}
	
	input, textarea, select {
		box-sizing: border-box;
		width: 100%;
		border: none;
		border-radius: var(--radius-md);
		background-color: var(--paper);
		color: var(--primary);
		padding: 10px;
	}

	input:focus, textarea:focus, select:focus {
		box-shadow: var(--focus-ring);
	}
	
	textarea {
		resize: vertical;
		min-height: 100px;
	}
	
	.button-container {
		display: flex;
		margin-top: 20px;
	}
	
	button {
		background-color: var(--paper);
		color: var(--primary);
		border: var(--bw) solid var(--paper);
		width: 100%;
		padding: var(--block-pad);
		border-radius: var(--radius-md);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
	}
	
	@media (hover: hover) {
		button:hover {
			background-color: var(--primary);
			color: var(--paper);
		}
	}
	
	.error-message {
		color: var(--paper);
		background-color: var(--urgent);
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}
	
	/* Status colours stay on edges and dots, never surfaces */
	.success-message {
		color: var(--primary);
		font-weight: var(--weight-bold);
		background-color: var(--paper);
		border: var(--bw) solid var(--ok);
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		margin-bottom: var(--space-md);
	}
	
	/* Mobile responsive styles */
	@media (max-width: 767px) {
		.form-container {
			padding: 12px 15px;
			margin-top: 10px;
		}
		
		.form-group {
			margin-bottom: 12px;
		}
		
		input, textarea, select {
			padding: 8px 10px;
		}
		
		textarea {
			min-height: 80px;
		}
		
		.button-container {
			margin-top: 15px;
		}
		
		button {
			width: 100%;
			padding: 10px;
		}
	}
	
	@media (max-width: 480px) {
		.modal {
			margin: 0 10px;
		}
		
		.form-container {
			padding: 10px;
		}
		
		label {
			font-size: var(--text-sm);
		}
	}
</style>

<div class="modal">
	<div class="form-container on-primary">
		{#if error}
			<div class="error-message" role="alert" transition:expand>{error}</div>
		{/if}
		
		{#if success}
			<div class="success-message" role="status" transition:expand>✓ Event added</div>
		{/if}
		
		<div class="form-group">
			<label for="title">Event Title *</label>
			<input 
				type="text" 
				id="title" 
				bind:value={newEvent.title} 
				placeholder="Enter event title"
				required
			/>
		</div>
		
		<div class="form-group">
			<DateTimePicker 
				id="event-datetime"
				bind:value={newEvent.when}
				required={true}
				on:change={handleDateTimeChange}
			/>
		</div>
		
		<div class="form-group">
			<label for="location">Location (optional)</label>
			<input 
				type="text" 
				id="location" 
				bind:value={newEvent.location} 
				placeholder="Enter event location"
			/>
		</div>
		
		<div class="form-group">
			<label for="description">Description (optional)</label>
			<textarea 
				id="description" 
				bind:value={newEvent.description} 
				placeholder="Enter event description"
			></textarea>
		</div>
		
		<div class="form-group">
			<label for="repeat-interval">Repeat Interval (optional)</label>
			<select id="repeat-interval" bind:value={newEvent.repeatInterval}>
				<option value="">None</option>
				<option value="weekly">Weekly</option>
				<option value="monthly">Monthly</option>
				<option value="yearly">Yearly</option>
			</select>
		</div>
		
		<div class="button-container">
			<button type="button" on:click={addEvent}>Add Event</button>
		</div>
	</div>
</div>