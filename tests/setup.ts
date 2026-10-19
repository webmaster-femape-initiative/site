import { beforeAll } from 'vitest';
import postgres from 'postgres';

beforeAll(async () => {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error('DATABASE_URL is not configured for tests');
	}

	const client = postgres(databaseUrl, {
		max: 1
	});

	try {
		const result = await client`
            SELECT current_database() AS database_name
        `;

		const databaseName = result[0]?.database_name;

		if (databaseName !== 'test') {
			throw new Error(`Test database verification failed: ${databaseName}`);
		}
	} finally {
		await client.end();
	}
});
