<script>
	// The member palettes, each drawn as a miniature of the app in its own
	// two colours; a real radio group underneath. Settings and the welcome
	// intro pick a theme with it.
	import { THEMES } from '$lib/theme';

	export let current = '';            // the selected palette id
	export let label = 'Theme';         // the group's accessible name
	export let onPick = (id) => {};

	const uid = Math.random().toString(36).slice(2, 8);
</script>

<fieldset class="theme-picker">
	<legend class="sr-only">{label}</legend>
	{#each THEMES as theme (theme.id)}
		<label
			class="theme-option"
			class:selected={theme.id === current}
			style="--swatch-primary: {theme.primary}; --swatch-paper: {theme.paper};"
		>
			<input
				type="radio"
				name="theme-{uid}"
				value={theme.id}
				checked={theme.id === current}
				on:change={() => onPick(theme.id)}
			/>
			<span class="swatch" aria-hidden="true">
				<span class="swatch-band">
					<span class="swatch-dot"></span>
					<span class="swatch-bar"></span>
				</span>
				<span class="swatch-page">
					<span class="swatch-line"></span>
					<span class="swatch-line short"></span>
					<span class="swatch-pill"></span>
				</span>
			</span>
			<span class="theme-name">{theme.name}</span>
		</label>
	{/each}
</fieldset>

<style>
	.theme-picker {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
		gap: var(--space-md);
		/* Three across on wide screens (six palettes, two even rows), two on phones */
		max-width: 560px;
		margin: 0 0 var(--space-sm);
		padding: 0;
		border: none;
	}

	.theme-option {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		color: var(--primary);
		font-size: var(--text-sm);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}

	/* The native radio stays for keyboard and screen readers, but is hidden */
	.theme-option input {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		opacity: 0;
	}

	/* A miniature of the app, drawn in that palette's own two colours */
	.swatch {
		display: flex;
		flex-direction: column;
		height: 84px;
		overflow: hidden;
		border: var(--bw) solid var(--swatch-primary);
		border-radius: var(--radius-lg);
		background: var(--swatch-paper);
		transition: var(--swap);
	}

	.swatch-band {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 24px;
		padding: 0 10px;
		background: var(--swatch-primary);
	}

	.swatch-dot {
		width: 10px;
		height: 10px;
		border-radius: var(--radius-circle);
		background: var(--swatch-paper);
	}

	.swatch-bar,
	.swatch-line {
		height: 6px;
		border-radius: var(--radius-pill);
	}

	.swatch-bar {
		width: 40%;
		background: var(--swatch-paper);
	}

	.swatch-page {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px;
	}

	.swatch-line {
		width: 70%;
		background: var(--swatch-primary);
	}

	.swatch-line.short {
		width: 45%;
	}

	.swatch-pill {
		width: 34px;
		height: 12px;
		margin-top: 2px;
		border-radius: var(--radius-sm);
		background: var(--swatch-primary);
	}

	.theme-option:active .swatch {
		transform: scale(0.97);
	}

	/* Selected: a double ring plus a tick, never colour alone */
	.theme-option.selected .swatch {
		box-shadow: 0 0 0 3px var(--paper), 0 0 0 5px var(--primary);
	}

	.theme-option.selected .theme-name::before {
		content: '✓ ';
	}

	.theme-option:has(input:focus-visible) .swatch {
		outline: var(--bw) solid var(--primary-deep);
		outline-offset: 7px;
	}

	@media (max-width: 480px) {
		/* Two palettes across, even on the smallest phones */
		.theme-picker {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-sm);
		}
	}
</style>
