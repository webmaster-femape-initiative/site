import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import { db } from '$lib/server/db';

describe('PostgreSQL test database', () => {
	it('connects to test', async () => {
		const result = await db.execute(sql`SELECT current_database() AS name`);

		expect(result[0].name).toBe('test');
	});
});
