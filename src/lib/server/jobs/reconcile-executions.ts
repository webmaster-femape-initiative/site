import type { createDb } from '../db/client.ts';

type DatabaseClient = ReturnType<typeof createDb>['client'];

export type ReconciliationResult = {
	abandonedJobs: number;
	supersededAttempts: number;
};

export async function reconcileInterruptedExecutions(
	client: DatabaseClient
): Promise<ReconciliationResult> {
	const gracePeriodMinutes = 2;

	// Cas 1 : le job n'est plus actif et la tentative
	// enregistrée correspond à la tentative courante.
	const abandoned = await client`
        UPDATE public.scheduled_job_executions AS e
        SET
            status = 'interrupted',
            completed_at = NOW(),
            message = 'Execution abandoned before completion',
            error_details =
                'pg-boss job is no longer active'
        FROM pgboss.job AS j
        WHERE
            e.job_id = j.id
            AND e.job_name = j.name
            AND e.status = 'running'
            AND e.attempt_number = j.retry_count + 1
            AND e.started_at <
                NOW() - ${gracePeriodMinutes} * INTERVAL '1 minute'
            AND j.state::text IN (
                'created',
                'retry',
                'failed',
                'cancelled',
                'completed'
            )
        RETURNING e.id
    `;

	// Cas 2 : pg-boss est passé à une tentative ultérieure,
	// quel que soit son état actuel.
	const superseded = await client`
        UPDATE public.scheduled_job_executions AS e
        SET
            status = 'interrupted',
            completed_at = NOW(),
            message = 'Execution superseded by a new attempt',
            error_details =
                'pg-boss started a subsequent attempt'
        FROM pgboss.job AS j
        WHERE
            e.job_id = j.id
            AND e.job_name = j.name
            AND e.status = 'running'
            AND e.attempt_number IS NOT NULL
            AND e.started_at <
                NOW() - ${gracePeriodMinutes} * INTERVAL '1 minute'
            AND j.retry_count + 1 > e.attempt_number
        RETURNING e.id
    `;

	return {
		abandonedJobs: abandoned.length,
		supersededAttempts: superseded.length
	};
}
