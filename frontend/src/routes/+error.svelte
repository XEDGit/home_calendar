<script>
	import { browser } from '$app/env';

	if (browser) {
		if (window.location.pathname != '/')
			window.location.href = '/?viewMode=' + window.location.pathname.slice(1);
		else
			window.location.href = '/';
	}
</script>