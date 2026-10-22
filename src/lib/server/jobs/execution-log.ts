import type { Database } from '$lib/server/db/client';

import { eq } from 'drizzle-orm';
import type postgres from 'postgres';

import { scheduledJobExecutions } from '$lib/server/db/schema';

export type JobExecutionStatus = 'completed' | 'partial' | 'failed';

export type JobExecutionResult = {
	processedCount: number;
	successCount: number;
	failureCount: number;
	message: string | null;
	errorDetails?: string | null;
};

export type JobExecutionContext = {
	jobId: string;
	jobName: string;
	attemptNumber?: number | null;
};

/**
 * Détermine le statut final d'une exécution à partir
 * des compteurs de succès et d'échecs.
 *
 * - completed : aucun échec
 * - partial   : au moins un succès et un échec
 * - failed    : aucun succès et au moins un échec
 */
export function getJobExecutionStatus(
	successCount: number,
	failureCount: number
): JobExecutionStatus {
	if (failureCount === 0) {
		return 'completed';
	}

	if (successCount === 0) {
		return 'failed';
	}

	return 'partial';
}

/**
 * Convertit une exception en texte pour la journalisation.
 */
function formatExecutionError(error: unknown): string {
	if (error instanceof Error) {
		return error.stack ?? `${error.name}: ${error.message}`;
	}

	return String(error);
}

async function getPgBossJobMetadata(
	client: ReturnType<typeof postgres>,
	jobId: string,
	jobName: string,
	fallbackAttemptNumber?: number | null
): Promise<{
	attemptNumber: number | null;
	startedAt: Date | null;
}> {
	const rows = await client<
		{
			retry_count: number;
			started_on: Date | string | null;
		}[]
	>`
        SELECT
            retry_count,
            started_on
        FROM pgboss.job
        WHERE id = ${jobId}::uuid
          AND name = ${jobName}
        LIMIT 1
    `;

	const job = rows[0];

	return {
		attemptNumber: job ? job.retry_count + 1 : (fallbackAttemptNumber ?? null),
		startedAt: job?.started_on ? new Date(job.started_on) : null
	};
}

/**
 * Crée un wrapper de journalisation des exécutions pg-boss.
 *
 * L'exception du traitement est systématiquement propagée
 * après journalisation pour permettre les retries pg-boss.
 */
export function createJobExecutionLogger(db: Database, client: ReturnType<typeof postgres>) {
	return async function withJobExecutionLog(
		context: JobExecutionContext,
		handler: () => Promise<JobExecutionResult>
	): Promise<void> {
		const metadata = await getPgBossJobMetadata(
			client,
			context.jobId,
			context.jobName,
			context.attemptNumber
		);

		const [execution] = await db
			.insert(scheduledJobExecutions)
			.values({
				jobId: context.jobId,
				jobName: context.jobName,
				attemptNumber: metadata.attemptNumber,
				pgbossStartedAt: metadata.startedAt,
				status: 'running',
				startedAt: new Date(),
				processedCount: 0,
				successCount: 0,
				failureCount: 0,
				message: null,
				errorDetails: null
			})
			.returning({
				id: scheduledJobExecutions.id
			});

		try {
			const result = await handler();

			const status = getJobExecutionStatus(result.successCount, result.failureCount);

			await db
				.update(scheduledJobExecutions)
				.set({
					status,
					processedCount: result.processedCount,
					successCount: result.successCount,
					failureCount: result.failureCount,
					message: result.message,
					errorDetails: result.errorDetails ?? null,
					completedAt: new Date()
				})
				.where(eq(scheduledJobExecutions.id, execution.id));
		} catch (error) {
			await db
				.update(scheduledJobExecutions)
				.set({
					status: 'failed',
					errorDetails: formatExecutionError(error),
					completedAt: new Date()
				})
				.where(eq(scheduledJobExecutions.id, execution.id));

			throw error;
		}
	};
}
