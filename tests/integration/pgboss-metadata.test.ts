import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { getPgBossJobMetadata } from '../../src/lib/server/jobs/pgboss-metadata.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);

describe('getPgBossJobMetadata', () => {
	afterAll(async () => {
		await client.end();
	});

	it('returns null when the job does not exist', async () => {
		const result = await getPgBossJobMetadata(client, randomUUID(), 'system.health-check', 1);

		expect(result.startedAt).toBeNull();
	});

	it('returns null when the attempt does not match', async () => {
		const [job] = await client<
			{
				id: string;
				name: string;
			}[]
		>`
            SELECT id, name
            FROM pgboss.job
            WHERE state = 'active'
            LIMIT 1
        `;

		if (!job) {
			return;
		}

		const result = await getPgBossJobMetadata(client, job.id, job.name, -999);

		expect(result.startedAt).toBeNull();
	});

	it('does not throw when metadata retrieval fails', async () => {
		const invalidJobId = 'invalid-uuid';

		await expect(
			getPgBossJobMetadata(client, invalidJobId, 'system.health-check', 1)
		).resolves.toEqual({
			startedAt: null
		});
	});
});
