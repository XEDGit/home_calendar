<script>
	import { browser } from '$app/environment';

	if (browser) {
		if (window.location.pathname != '/')
			window.location.href = '/?viewMode=' + window.location.pathname.slice(1);
		else
			window.location.href = '/';
	}
</script>