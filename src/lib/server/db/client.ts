import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema.ts';
import * as relations from './relations.ts';

export function createDb(connectionString: string) {
	const client = postgres(connectionString);

	const db = drizzle(client, {
		schema: {
			...schema,
			...relations
		}
	});

	return { db, client };
}

export type Database = ReturnType<typeof createDb>['db'];
