import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { config } from 'dotenv';

config({ path: '.env.test', override: true });

export default defineConfig({
	plugins: [sveltekit()],

	test: {
		fileParallelism: false,

		projects: [
			{
				test: {
					name: 'unit',
					include: ['tests/unit/**/*.test.ts'],
					environment: 'node'
				}
			},
			{
				test: {
					name: 'integration',
					include: ['tests/integration/**/*.test.ts'],
					setupFiles: ['tests/setup.ts'],
					environment: 'node',
					fileParallelism: false
				}
			}
		]
	}
});
