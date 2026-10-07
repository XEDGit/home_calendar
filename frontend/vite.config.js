import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
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
