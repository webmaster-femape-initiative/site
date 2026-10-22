import type { createDb } from '../db/client.ts';

type DatabaseClient = ReturnType<typeof createDb>['client'];

export type PgBossJobMetadata = {
	startedAt: Date | null;
};

export async function getPgBossJobMetadata(
	client: DatabaseClient,
	jobId: string,
	jobName: string,
	attemptNumber?: number
): Promise<PgBossJobMetadata> {
	try {
		const [job] = await client<
			{
				started_on: string | Date | null;
			}[]
		>`
            SELECT started_on
            FROM pgboss.job
            WHERE id = ${jobId}::uuid
              AND name = ${jobName}
              AND state = 'active'
              AND retry_count = ${attemptNumber ?? -1} - 1
        `;

		if (!job?.started_on) {
			return { startedAt: null };
		}

		const startedAt = job.started_on instanceof Date ? job.started_on : new Date(job.started_on);

		if (Number.isNaN(startedAt.getTime())) {
			console.warn('[worker] Invalid pg-boss start date:', { jobId, jobName });

			return { startedAt: null };
		}

		return { startedAt };
	} catch (error) {
		console.warn('[worker] Unable to retrieve pg-boss metadata:', { jobId, jobName, error });

		return { startedAt: null };
	}
}
