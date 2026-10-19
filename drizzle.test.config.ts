import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({
	path: '.env.test',
	override: true
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error('DATABASE_URL is not set in .env.test');
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\/+/, '');

if (databaseName !== 'test') {
	throw new Error(`Refusing to run test migrations on database "${databaseName}".`);
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl
	},
	verbose: true,
	strict: true
});
