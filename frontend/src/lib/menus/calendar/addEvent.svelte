<script>
	import { postFrontend } from "$lib/requests";
	import Section from "$lib/header/Section.svelte";
	import DateTimePicker from "$lib/inputs/DateTimePicker.svelte";
	import { onMount } from "svelte";

	let newEvent = {
		title: '',
		when: new Date().toISOString(),
		location: '',
		description: ''
	};

	let error = '';
	let success = false;

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
				// Reset form after successful submission
				newEvent = {
					title: '',
					when: new Date().toISOString(),
					location: '',
					description: ''
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

	onMount(() => {
		window.scrollTo(0, 0);
	});
</script>

<style>
	.modal {
		display: flex;
		flex-direction: column;
		margin: 0 15px;
	}
	
	.form-container {
		margin-top: 15px;
		background-color: #96616B;
		border-radius: 10px;
		padding: 15px 20px;
		color: #FFEAD0;
	}
	
	.form-group {
		margin-bottom: 15px;
	}
	
	label {
		display: block;
		margin-bottom: 5px;
		font-weight: bold;
	}
	
	input, textarea {
		width: 100%;
		border: none;
		border-radius: 5px;
		background-color: #FFEAD0;
		color: #96616B;
		padding: 10px 2px;
	}

	input:focus, textarea:focus {
		outline: none;
		box-shadow: 0 0 0 2px rgba(150, 97, 107, 0.3);
	}
	
	textarea {
		resize: vertical;
		min-height: 100px;
	}
	
	.button-container {
		display: flex;
		justify-content: flex-end;
		margin-top: 20px;
	}
	
	button {
		background-color: #FFEAD0;
		color: #96616B;
		border: none;
		padding: 10px 20px;
		border-radius: 5px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.3s;
	}
	
	button:hover {
		background-color: #f3d8b6;
	}
	
	.error-message {
		color: #f8d7da;
		background-color: #d9534f;
		padding: 10px;
		border-radius: 5px;
		margin-bottom: 15px;
	}
	
	.success-message {
		color: #d4edda;
		background-color: #28a745;
		padding: 10px;
		border-radius: 5px;
		margin-bottom: 15px;
	}
</style>

<div class="modal">
	<div class="form-container">
		{#if error}
			<div class="error-message">{error}</div>
		{/if}
		
		{#if success}
			<div class="success-message">Event added successfully!</div>
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
		
		<div class="button-container">
			<button type="button" on:click={addEvent}>Add Event</button>
		</div>
	</div>
</div>