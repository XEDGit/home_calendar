<script>
	// The card that shows, edits and adds events and todos: a rose band with
	// what it is and a close button, a body that scrolls, a footer that stays
	// put. Centred over the page; a sheet rising from the bottom on phones.
	// The field and fact styles below are shared by EventSheet and TodoSheet.
	import { modalDialog, closeDialog } from '$lib/motion';
	import Icon from './Icon.svelte';

	export let kind = '';          // shown in the band: "Event", "New todo"…
	export let label = '';         // the dialog's accessible name
	export let lockBackdrop = false;
	export let onClose = () => {};
	export let dialog = null;      // bound: for closeDialog() and morphHeight()
</script>

<dialog class="dialog sheet" aria-label={label || kind} bind:this={dialog} use:modalDialog={{ lockBackdrop }} on:close={() => onClose()}>
	<header class="band on-primary">
		<span class="kind">{kind}</span>
		<button type="button" class="close" aria-label="Close" on:click={() => closeDialog(dialog)}>
			<Icon name="close" size={20} />
		</button>
	</header>
	<div class="body">
		<slot />
	</div>
	{#if $$slots.footer}
		<footer class="foot">
			<slot name="footer" />
		</footer>
	{/if}
</dialog>

<style>
	/* ── Shell ── */
	.sheet {
		padding: 0;
		border: none;
		margin: auto;
		width: min(34rem, calc(100% - 2 * var(--space-md)));
		max-width: none;
		max-height: min(88dvh, 52rem);
		border-radius: var(--radius-lg);
		background: var(--paper);
		color: var(--primary);
		box-shadow: var(--shadow-modal);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.sheet:not([open]) { display: none; }

	.band {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		min-height: 3rem;
		box-sizing: border-box;
		padding: var(--space-xs) var(--space-xs) var(--space-xs) var(--space-md);
		background: var(--primary);
		color: var(--paper);
	}
	/* A printed-ledger label: small bold capitals */
	.kind {
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.close {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		padding: 0;
		border: var(--bw) solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: var(--paper);
		cursor: pointer;
		transition: var(--swap);
	}
	@media (hover: hover) {
		.close:hover { border-color: var(--paper); }
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: var(--space-md) var(--space-md) var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		scrollbar-width: thin;
		scrollbar-color: var(--primary-a45) transparent;
	}

	.foot {
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-top: var(--bw-hair) solid var(--primary-a25);
	}

	/* Phones: a sheet from the bottom, full width, clear of the home bar */
	@media (max-width: 640px) {
		.sheet {
			width: 100%;
			margin: auto 0 0;
			max-height: 92dvh;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		}
		.foot { padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom)); }
	}

	/* ── View: an almanac entry ── */
	.sheet :global(.entry-title) {
		margin: 0;
		font-size: var(--text-lg);
		line-height: var(--leading-tight);
		color: var(--primary);
		overflow-wrap: break-word;
		text-wrap: balance;
	}
	.sheet :global(.facts) {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}
	.sheet :global(.facts li) {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		color: var(--primary);
		line-height: var(--leading-snug);
		overflow-wrap: break-word;
		min-width: 0;
	}
	.sheet :global(.facts li > .icon) { margin-top: 1px; }
	.sheet :global(.facts .quiet) { font-style: italic; }
	.sheet :global(.facts .urgent) { color: var(--urgent); font-weight: var(--weight-bold); }
	.sheet :global(.notes) {
		margin: 0;
		color: var(--ink);
		white-space: pre-line;
		overflow-wrap: break-word;
	}
	.sheet :global(.dot) {
		flex-shrink: 0;
		width: 10px;
		height: 10px;
		margin: 4px;
		border-radius: var(--radius-circle);
		background: var(--idle);
	}
	.sheet :global(.tagchip) {
		display: inline-block;
		padding: 0 var(--space-sm);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-pill);
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
	}

	/* ── Edit and add: labels above full-width fields ── */
	.sheet :global(.fields) { display: flex; flex-direction: column; gap: var(--space-md); }
	.sheet :global(.field) {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: none;
	}
	.sheet :global(.label) {
		padding: 0;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		color: var(--primary);
	}
	.sheet :global(.row) { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
	.sheet :global(.row > .input) { flex: 1 1 9rem; }
	/* Text fields: the system's underline. Dates, times, notes: boxed. */
	.sheet :global(.line) {
		box-sizing: border-box;
		width: 100%;
		min-height: var(--control-min-h);
		padding: 4px 0;
		border: none;
		border-bottom: var(--bw) solid var(--primary);
		border-radius: 0;
		background: none;
		color: var(--primary);
		font: inherit;
		transition: var(--swap);
	}
	.sheet :global(.line.big) { font-size: var(--text-md); font-weight: var(--weight-bold); }
	.sheet :global(.input) {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: var(--control-min-h);
		padding: 7px 10px;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-md);
		background: var(--paper);
		color: var(--primary);
		font: inherit;
		transition: var(--swap);
	}
	.sheet :global(textarea.input) {
		resize: none;
		line-height: var(--leading-body);
		color: var(--ink);
		field-sizing: content;
		min-height: calc(3lh + 18px);
		max-height: 14rem;
	}
	.sheet :global(.line:focus), .sheet :global(.input:focus) { border-color: var(--primary-deep); }
	.sheet :global(.line[aria-invalid='true']) { border-bottom-color: var(--urgent); }
	.sheet :global(::placeholder) { color: var(--primary); font-style: italic; opacity: 1; }
	.sheet :global(.hint) { font-size: var(--text-sm); font-style: italic; color: var(--primary); }
	.sheet :global(.field-error) { font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--urgent); }

	/* One-tap choices: real radios, drawn as pills that invert when picked */
	.sheet :global(.choices) { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
	.sheet :global(.choice) { position: relative; display: inline-flex; }
	.sheet :global(.choice input) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.sheet :global(.choice > span),
	.sheet :global(.quick) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 36px;
		box-sizing: border-box;
		padding: 0 var(--space-sm);
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-pill);
		background: var(--paper);
		color: var(--primary);
		font: inherit;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		white-space: nowrap;
		cursor: pointer;
		transition: var(--swap);
	}
	.sheet :global(.choice input:checked + span),
	.sheet :global(.quick.on) { background: var(--primary); color: var(--paper); }
	.sheet :global(.choice input:focus-visible + span) { outline: var(--bw) solid var(--primary-deep); outline-offset: 2px; }
	.sheet :global(.choice > span .dot) { margin: 0; width: 9px; height: 9px; }
	@media (hover: hover) {
		.sheet :global(.choice:hover input:not(:checked) + span),
		.sheet :global(.quick:not(.on):hover) { background: var(--paper-shade); }
	}

	/* A switch: the checkbox is the whole row, the track shows its state */
	.sheet :global(.switch) {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-height: var(--control-min-h);
		color: var(--primary);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}
	.sheet :global(.switch input) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}
	.sheet :global(.track) {
		flex-shrink: 0;
		position: relative;
		width: 44px;
		height: 26px;
		box-sizing: border-box;
		border: var(--bw) solid var(--primary);
		border-radius: var(--radius-pill);
		background: var(--paper);
		transition: var(--swap);
	}
	.sheet :global(.track::after) {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 16px;
		height: 16px;
		border-radius: var(--radius-circle);
		background: var(--primary);
		transition: translate var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out);
	}
	.sheet :global(.switch input:checked + .track) { background: var(--primary); }
	.sheet :global(.switch input:checked + .track::after) { translate: 18px 0; background: var(--paper); }
	.sheet :global(.switch input:focus-visible + .track) { outline: var(--bw) solid var(--primary-deep); outline-offset: 2px; }
	.sheet :global(.switch small) { display: block; font-weight: var(--weight-regular); font-style: italic; font-size: var(--text-sm); }

	/* ── Footer ── */
	.sheet :global(.spacer) { flex: 1; }
	.sheet :global(.foot-error) {
		flex-basis: 100%;
		margin: 0;
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		color: var(--urgent);
	}
	/* Delete is quiet until it asks to be sure, then it's the red button */
	.sheet :global(.delete) {
		min-height: var(--control-min-h);
		padding: 0 var(--space-sm);
		border: var(--bw) solid transparent;
		border-radius: var(--radius-md);
		background: none;
		color: var(--danger);
		font: inherit;
		font-weight: var(--weight-bold);
		white-space: nowrap;
		cursor: pointer;
		transition: var(--swap);
	}
	.sheet :global(.delete.sure) { background: var(--danger); border-color: var(--danger); color: var(--paper); }
	@media (hover: hover) {
		.sheet :global(.delete:not(.sure):hover) { border-color: var(--danger); }
	}
	.sheet :global(.foot .btn) { white-space: nowrap; }
	.sheet :global(.foot .btn:disabled) { border-color: var(--idle); background: var(--idle); color: var(--paper); cursor: default; }

	@media (prefers-reduced-motion: reduce) {
		.sheet :global(.track::after) { transition: none; }
	}
</style>
