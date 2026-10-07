<script>
	import { tick } from 'svelte';
	import { reveal, vanish, expand } from '$lib/motion';

	// Called after the assistant changed something, so the page can reload
	export let onChange = () => {};

	// [{ role: 'user'|'assistant', content, tools?, plan?, doneActions?, error? }]
	let messages = [];
	let input = '';
	let busy = false;
	let log;

	// Voice
	let recorder = null;
	let recording = false;
	let transcribing = false;
	const canRecord = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

	async function scrollDown() {
		await tick();
		if (log) log.scrollTop = log.scrollHeight;
	}

	function history() {
		return messages
			.filter(m => !m.error && m.content)
			.map(m => ({ role: m.role, content: m.content }));
	}

	async function send(text = input) {
		text = text.trim();
		if (!text || busy) return;
		const past = history();
		input = '';
		busy = true;
		messages = [...messages, { role: 'user', content: text }];
		const reply = { role: 'assistant', content: '', tools: [], plan: null, doneActions: null, error: null };
		messages = [...messages, reply];
		await scrollDown();

		try {
			const res = await fetch('/api/assistant', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, history: past }),
			});
			if (!res.ok || !res.body) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || 'The assistant is unavailable right now');
			}
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				let cut;
				while ((cut = buffer.indexOf('\n\n')) >= 0) {
					const chunk = buffer.slice(0, cut);
					buffer = buffer.slice(cut + 2);
					for (const line of chunk.split('\n')) {
						if (line.startsWith('data:')) handleEvent(reply, JSON.parse(line.slice(5)));
					}
				}
				messages = messages;
				await scrollDown();
			}
		} catch (err) {
			reply.error = err.message;
		}
		reply.content = reply.content.trim();
		messages = messages;
		busy = false;
		await scrollDown();
		if (reply.doneActions?.length) onChange();
	}

	function handleEvent(reply, ev) {
		if (ev.type === 'text') reply.content += ev.text;
		else if (ev.type === 'tool') reply.tools = [...reply.tools, ev];
		else if (ev.type === 'plan') {
			reply.plan = {
				id: ev.planId,
				state: 'review', // review → running → finished | expired
				actions: ev.actions.map(a => ({ ...a, checked: true, status: null, error: null })),
			};
		}
		else if (ev.type === 'done_actions') reply.doneActions = ev.actions;
		else if (ev.type === 'error') reply.error = ev.error;
	}

	// Unticking an action also unticks the ones built on it
	function toggle(plan, action) {
		action.checked = !action.checked;
		if (!action.checked) {
			let changed = true;
			while (changed) {
				changed = false;
				for (const a of plan.actions) {
					if (a.checked && a.deps.some(ref => plan.actions.find(x => x.ref === ref && !x.checked))) {
						a.checked = false;
						changed = true;
					}
				}
			}
		}
		messages = messages;
	}

	async function confirmPlan(plan) {
		const refs = plan.actions.filter(a => a.checked).map(a => a.ref);
		if (!refs.length) return cancelPlan(plan);
		plan.state = 'running';
		messages = messages;
		try {
			const res = await fetch('/api/assistantConfirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ planId: plan.id, refs }),
			});
			const data = await res.json();
			if (!res.ok) {
				plan.state = 'expired';
				plan.error = data.error;
			} else {
				for (const r of data.results) {
					const a = plan.actions.find(x => x.ref === r.ref);
					if (a) { a.status = r.status; a.error = r.error || null; }
				}
				plan.state = 'finished';
				if (data.results.some(r => r.status === 'done')) onChange();
			}
		} catch {
			plan.state = 'expired';
			plan.error = 'Could not reach the server';
		}
		messages = messages;
	}

	function cancelPlan(plan) {
		plan.state = 'finished';
		plan.actions.forEach(a => { a.status = 'skipped'; });
		messages = messages;
	}

	const STATUS = { done: '✓', failed: '✕', skipped: '–', not_run: '–' };

	// ── Voice ───────────────────────────────────────────────────────────────
	async function toggleRecording() {
		if (recording) {
			recorder?.stop();
			return;
		}
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (err) {
			const error = {
				NotAllowedError: 'Microphone access is blocked. Allow it in the browser’s site settings (and the browser’s app permissions on Android).',
				NotFoundError: 'No microphone was found',
				NotReadableError: 'The microphone is in use by another app',
			}[err?.name] || `Could not open the microphone (${err?.name || err})`;
			messages = [...messages, { role: 'assistant', content: '', error }];
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
				if (text) await send(text);
			} catch (err) {
				messages = [...messages, { role: 'assistant', content: '', error: err.message || 'Could not understand the recording' }];
			}
			transcribing = false;
		};
		recorder.start();
		recording = true;
	}
</script>

<div class="assistant">
	{#if messages.length}
		<div class="log" bind:this={log} transition:expand>
			{#each messages as m}
				<div class="msg {m.role}" in:reveal>
					{#if m.content}
						<p class="bubble">{m.content}</p>
					{:else if m.role === 'assistant' && busy && m === messages[messages.length - 1] && !m.tools?.length}
						<p class="bubble thinking" aria-live="polite">Thinking…</p>
					{/if}

					{#if m.doneActions?.length}
						<ul class="actions">
							{#each m.doneActions as a}
								<li class="action done"><span class="mark">✓</span>{a.summary}</li>
							{/each}
						</ul>
					{/if}

					{#if m.plan}
						<div class="plan" class:settled={m.plan.state !== 'review'}>
							<p class="plan-title">
								{#if m.plan.state === 'review'}Review before I go ahead{:else if m.plan.state === 'running'}Working…{:else if m.plan.state === 'expired'}{m.plan.error}{:else}Result{/if}
							</p>
							<ul class="actions">
								{#each m.plan.actions as a (a.ref)}
									<li class="action" class:failed={a.status === 'failed'} class:skipped={a.status === 'skipped' || a.status === 'not_run'}>
										{#if m.plan.state === 'review'}
											<label>
												<input type="checkbox" checked={a.checked} on:change={() => toggle(m.plan, a)} />
												<span>{a.summary}</span>
											</label>
										{:else}
											<span class="mark">{a.status ? STATUS[a.status] : '·'}</span>
											<span>{a.summary}{#if a.error}<span class="err"> — {a.error}</span>{/if}</span>
										{/if}
									</li>
								{/each}
							</ul>
							{#if m.plan.state === 'review'}
								<div class="plan-buttons">
									<button class="btn primary" on:click={() => confirmPlan(m.plan)}>
										{m.plan.actions.every(a => a.checked) ? 'Do it' : `Do ${m.plan.actions.filter(a => a.checked).length} selected`}
									</button>
									<button class="btn" on:click={() => cancelPlan(m.plan)}>Cancel</button>
								</div>
							{/if}
						</div>
					{/if}

					{#if m.error}
						<p class="bubble error">{m.error}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<form class="composer" on:submit|preventDefault={() => send()}>
		<input
			class="text"
			type="text"
			bind:value={input}
			placeholder={recording ? 'Listening… tap the mic to stop' : transcribing ? 'Transcribing…' : 'Ask, or tell me what you did'}
			disabled={busy || recording || transcribing}
			maxlength="2000"
			aria-label="Message the assistant"
		/>
		{#if canRecord}
			<button type="button" class="icon" class:recording on:click={toggleRecording}
				disabled={busy || transcribing} aria-label={recording ? 'Stop recording' : 'Speak'} aria-pressed={recording}>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
					<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
					<path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" />
				</svg>
			</button>
		{/if}
		<button type="submit" class="icon send" disabled={busy || !input.trim()} aria-label="Send">
			<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
				<path d="M4 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	</form>
	{#if messages.length && !busy}
		<button class="clear" on:click={() => { messages = []; }} out:vanish>Clear conversation</button>
	{/if}
</div>

<style>
	.assistant {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	/* ── Conversation ─────────────────────────────────────────────────────── */
	.log {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		max-height: min(55vh, 480px);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 2px;
	}

	.msg {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		max-width: min(100%, var(--measure));
	}
	.msg.user { align-self: flex-end; align-items: flex-end; }
	.msg.assistant { align-self: flex-start; }

	.bubble {
		margin: 0;
		padding: var(--control-pad-y) var(--control-pad-x);
		border-radius: var(--radius-lg);
		font-size: var(--text-base);
		line-height: var(--leading-body);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.user .bubble {
		background: var(--primary);
		color: var(--paper);
		border-bottom-right-radius: var(--radius-sm);
	}
	.assistant .bubble {
		background: var(--primary-a08);
		color: var(--ink);
		border: var(--bw-hair) solid var(--primary-a25);
		border-bottom-left-radius: var(--radius-sm);
	}
	.bubble.thinking { color: var(--primary); font-style: italic; }
	.bubble.error {
		background: var(--urgent-a12);
		border-color: transparent;
		color: var(--urgent);
		font-size: var(--text-sm);
	}

	/* ── Actions and the review list ──────────────────────────────────────── */
	.plan {
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-lg);
		padding: var(--space-sm) var(--space-md);
		background: var(--paper);
		transition: var(--swap);
	}
	.plan.settled { border-color: var(--primary-a25); }

	.plan-title {
		margin: 0 0 var(--space-xs);
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		color: var(--primary);
	}

	.actions {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.action {
		display: flex;
		gap: var(--space-sm);
		align-items: baseline;
		font-size: var(--text-sm);
		line-height: var(--leading-snug);
		color: var(--ink);
		padding: 3px 0;
	}
	.action label {
		display: flex;
		gap: var(--space-sm);
		align-items: baseline;
		cursor: pointer;
	}
	.action input { accent-color: var(--primary); flex-shrink: 0; }
	.action .mark {
		width: 1ch;
		flex-shrink: 0;
		font-weight: var(--weight-bold);
		color: var(--ok);
	}
	.action.failed .mark, .action .err { color: var(--urgent); }
	.action.skipped { color: var(--muted); }
	.action.skipped .mark { color: var(--muted); }
	.actions > .action.done { color: var(--primary); }

	.plan-buttons {
		display: flex;
		gap: var(--space-sm);
		margin-top: var(--space-sm);
		flex-wrap: wrap;
	}

	.btn {
		min-height: var(--control-min-h);
		padding: var(--control-pad-y) var(--control-pad-x);
		border-radius: var(--radius-md);
		border: var(--bw) solid var(--primary);
		background: var(--paper);
		color: var(--primary);
		font: inherit;
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: var(--swap);
	}
	.btn:hover { background: var(--paper-shade); }
	.btn.primary { background: var(--primary); color: var(--paper); }
	.btn.primary:hover { background: var(--primary-deep); }
	.btn:active { transform: scale(0.97); }

	/* ── Composer ─────────────────────────────────────────────────────────── */
	.composer {
		display: flex;
		gap: var(--space-xs);
		align-items: stretch;
	}

	.text {
		flex: 1;
		min-width: 0;
		min-height: var(--control-min-h);
		padding: var(--control-pad-y) var(--control-pad-x);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-pill);
		background: var(--paper);
		color: var(--ink);
		font: inherit;
		transition: var(--swap);
	}
	.text::placeholder { color: var(--muted); }
	.text:focus { outline: none; border-color: var(--primary-deep); box-shadow: var(--focus-ring); }
	.text:disabled { opacity: 0.7; }

	.icon {
		flex-shrink: 0;
		width: var(--control-min-h);
		height: var(--control-min-h);
		display: grid;
		place-items: center;
		border-radius: var(--radius-circle);
		border: var(--bw) solid var(--primary);
		background: var(--paper);
		color: var(--primary);
		cursor: pointer;
		transition: var(--swap);
	}
	.icon:hover:not(:disabled) { background: var(--paper-shade); }
	.icon:active:not(:disabled) { transform: scale(0.94); }
	.icon:disabled { border-color: var(--idle); color: var(--idle); cursor: default; }
	.icon.send:not(:disabled) { background: var(--primary); color: var(--paper); }
	.icon.send:hover:not(:disabled) { background: var(--primary-deep); }
	.icon.recording {
		background: var(--urgent);
		border-color: var(--urgent);
		color: var(--paper);
		animation: pulse 1.4s var(--ease-in-out) infinite;
	}
	@keyframes pulse {
		50% { box-shadow: 0 0 0 6px var(--urgent-a12); }
	}
	@media (prefers-reduced-motion: reduce) {
		.icon.recording { animation: none; }
	}

	.clear {
		align-self: flex-end;
		background: none;
		border: none;
		padding: 0;
		color: var(--primary);
		font: inherit;
		font-size: var(--text-xs);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
