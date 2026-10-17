<script>
	import '#lib/general.css';
	import { onNavigate } from '$app/navigation';
	import { reducedMotion } from '#lib/motion.js';

	// Route changes (app ↔ error page, links between routes) crossfade the
	// same way in-app views do. In-app view switches use viewTransition().
	onNavigate((navigation) => {
		if (navigation.shallow && navigation.type === 'goto') return;
		if (!document.startViewTransition || reducedMotion()) return;
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<slot />
