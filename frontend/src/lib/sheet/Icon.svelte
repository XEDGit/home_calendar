<script>
	// Line icons for the sheets: one stroke weight, drawn in currentColor
	export let name;
	export let size = 18;

	const PATHS = {
		clock: ['M12 7v5l3 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z'],
		repeat: ['M17 2l4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'M7 22l-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3'],
		pin: ['M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z', 'M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z'],
		flag: ['M5 21V4', 'M5 4h12l-2.5 4L17 12H5'],
		tag: ['M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z', 'M8 7.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0z'],
		people: ['M12 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', 'M3 20a6 6 0 0 1 12 0', 'M16 5a3 3 0 0 1 0 6', 'M21 20a6 6 0 0 0-3.5-5.4'],
		lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
		check: ['M5 12.5l4.5 4.5L19 7'],
		close: ['M6 6l12 12', 'M18 6L6 18'],
	};
</script>

<svg class="icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
	{#each PATHS[name] ?? [] as d}<path {d} />{/each}
</svg>

<style>
	.icon {
		flex-shrink: 0;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
