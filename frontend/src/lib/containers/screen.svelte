<script>
	import ContentLayout from './contentLayout.svelte';

	// One screen of the app: a tab or a form. A hidden screen stays mounted,
	// so a tab keeps its data between visits. During a page change each
	// screen is its own View Transition group (`--vt-name`, general.css): the
	// one you leave and the one you open push sideways side by side.
	export let name;
	export let active = false;

	$: title = name.replace(/([a-z])([A-Z])/g, '$1 $2');
</script>

<div class="screen" hidden={!active} style="--vt-name: screen-{name}">
	<ContentLayout {title}>
		<slot />
	</ContentLayout>
</div>
