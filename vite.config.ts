import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),

		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',

			strategy: ['url', 'preferredLanguage', 'baseLocale'],

			urlPatterns: [
				{
					pattern: '/api/:path(.*)?',
					localized: [
						['en', '/api/:path(.*)?'],
						['fr', '/api/:path(.*)?']
					]
				},
				{
					pattern: '/',
					localized: [
						['en', '/en'],
						['fr', '/fr']
					]
				},
				{
					pattern: '/:path(.*)?',
					localized: [
						['en', '/en/:path(.*)?'],
						['fr', '/fr/:path(.*)?']
					]
				}
			],

			emitTsDeclarations: true
		}),

		sveltekit()
	],

	server: {
		allowedHosts: ['.trycloudflare.com']
	}
});
