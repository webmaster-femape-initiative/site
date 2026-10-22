import { env } from '$env/dynamic/private';
import { createDb } from './client.ts';

if (!env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

export const { db, client } = createDb(env.DATABASE_URL);
