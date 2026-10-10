<script>
	// Text + voice input. `onSend(text)` resolves { error } when the message
	// was not accepted (queue full, server down): the text then stays.
	export let onSend = async () => ({});
	export let placeholder = 'Ask, or tell me what you did';

	let input = '';
	let sending = false;
	let error = null;

	let recorder = null;
	let recording = false;
	let transcribing = false;
	const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

	async function submit(text = input) {
		text = text.trim();
		if (!text || sending) return;
		sending = true;
		error = null;
		const result = await onSend(text);
		sending = false;
		if (result?.error) {
			error = result.error;
			input = text;
		} else {
			input = '';
		}
	}

	async function toggleRecording() {
		if (recording) {
			recorder?.stop();
			return;
		}
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (err) {
			error = {
				NotAllowedError: 'Microphone access is blocked. Allow it in the browser’s site settings (and the browser’s app permissions on Android).',
				NotFoundError: 'No microphone was found',
				NotReadableError: 'The microphone is in use by another app',
			}[err?.name] || `Could not open the microphone (${err?.name || err})`;
			return;
		}
		const chunks = [];
		recorder = new MediaRecorder(stream);
		recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
		recorder.onstop = async () => {
			stream.getTracks().forEach(t => t.stop());
			recording = false;
			transcribing = true;
			try {
				const res = await fetch('/api/transcribe', {
					method: 'POST',
					headers: { 'Content-Type': recorder.mimeType || 'audio/webm' },
					body: new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error);
				const text = (data.text || '').trim();
				if (text) await submit(text);
			} catch (err) {
				error = err.message || 'Could not understand the recording';
			}
			transcribing = false;
		};
		recorder.start();
		recording = true;
		error = null;
	}
</script>

<form class="composer" on:submit|preventDefault={() => submit()}>
	<input
		class="text"
		type="text"
		bind:value={input}
		placeholder={recording ? 'Listening… tap the mic to stop' : transcribing ? 'Transcribing…' : placeholder}
		disabled={sending || recording || transcribing}
		maxlength="2000"
		aria-label="Message the assistant"
	/>
	{#if canRecord}
		<button type="button" class="icon" class:recording on:click={toggleRecording}
			disabled={sending || transcribing} aria-label={recording ? 'Stop recording' : 'Speak'} aria-pressed={recording}>
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
				<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
				<path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
			</svg>
		</button>
	{/if}
	<button type="submit" class="icon send" disabled={sending || !input.trim()} aria-label="Send">
		<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
			<path d="M4 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>
</form>
{#if error}
	<p class="input-error" role="alert">{error}</p>
{/if}

<style>
	/* Moved unchanged from AssistantChat.svelte (composer section) */
	.composer { display: flex; gap: var(--space-xs); align-items: center; }
	/* Border-box, so the field is exactly as tall as the round buttons beside it */
	.text {
		flex: 1; min-width: 0; box-sizing: border-box; height: var(--control-min-h);
		padding: 0 var(--control-pad-x);
		border: var(--bw) solid var(--primary); border-radius: var(--radius-pill);
		background: var(--paper); color: var(--ink); font: inherit; transition: var(--swap);
	}
	.text::placeholder { color: var(--primary); font-style: italic; opacity: 1; }
	.text:focus { border-color: var(--primary-deep); box-shadow: var(--focus-ring); }
	.text:disabled { opacity: 0.7; }
	.icon {
		flex-shrink: 0; width: var(--control-min-h); height: var(--control-min-h);
		display: grid; place-items: center; border-radius: var(--radius-circle);
		border: var(--bw) solid var(--primary); background: var(--paper); color: var(--primary);
		cursor: pointer; transition: var(--swap);
	}
	.icon:hover:not(:disabled) { background: var(--paper-shade); }
	.icon:active:not(:disabled) { transform: scale(0.94); }
	.icon:disabled { border-color: var(--idle); color: var(--idle); cursor: default; }
	.icon.send:not(:disabled) { background: var(--primary); color: var(--paper); }
	.icon.send:hover:not(:disabled) { background: var(--primary-deep); }
	.icon.recording {
		background: var(--urgent); border-color: var(--urgent); color: var(--paper);
		animation: pulse 1.4s var(--ease-in-out) infinite;
	}
	@keyframes pulse { 50% { box-shadow: 0 0 0 6px var(--urgent-a12); } }
	@media (prefers-reduced-motion: reduce) { .icon.recording { animation: none; } }
	.input-error { margin: var(--space-xs) 0 0; color: var(--urgent); font-size: var(--text-sm); }
</style>
