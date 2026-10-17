import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			// Sent on every page. SvelteKit puts a nonce on its own inline script,
			// so no other inline or eval'd script runs. Inline styles stay allowed:
			// style= attributes and Svelte's transitions use them.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
					'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
					'img-src': ['self', 'data:', 'blob:'],
					'connect-src': ['self'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'frame-ancestors': ['none'],
					'form-action': ['self']
				}
			}
		})
	],
	server: {
		port: 5173,
		strictPort: true,
		host: '0.0.0.0',
		https: false,
		// Vite >=5.4.12 rejects unknown Host headers; allow the public domain
		// so requests proxied through nginx keep working after upgrades.
		allowedHosts: ['homecalendar.casa'],
	}
});
