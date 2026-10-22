import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { reconcileInterruptedExecutions } from '../../src/lib/server/jobs/reconcile-executions.ts';

import { createBoss } from '../../src/lib/server/jobs/boss.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString);

const boss = createBoss(connectionString);

// Utiliser une queue propre aux tests pour éviter toute collision
// avec les jobs du worker de développement.
const queueName = 'test.reconcile-executions';

type Fixture = {
	jobId: string;
	executionId: string;
};

async function createFixture(
	state: 'active' | 'created' | 'retry' | 'failed' | 'cancelled' | 'completed',
	options: {
		retryCount?: number;
		attemptNumber?: number;
		ageMinutes?: number;
		pgbossStartedAgeMinutes?: number;
		executionStatus?: 'running' | 'completed';
	} = {}
): Promise<Fixture> {
	const jobId = randomUUID();
	const executionId = randomUUID();

	const retryCount = options.retryCount ?? 0;
	const attemptNumber = options.attemptNumber ?? retryCount + 1;
	const ageMinutes = options.ageMinutes ?? 10;
	const startedAgeMinutes = options.pgbossStartedAgeMinutes ?? ageMinutes;

	await client`
        INSERT INTO pgboss.job (
            id,
            name,
            state,
            data,
            retry_count,
            started_on
        )
        VALUES (
            ${jobId}::uuid,
            ${queueName},
            ${state}::pgboss.job_state,
            '{}'::jsonb,
            ${retryCount},
            NOW() - ${startedAgeMinutes} * INTERVAL '1 minute'
        )
    `;

	await client`
        INSERT INTO public.scheduled_job_executions (
            id,
            job_id,
            job_name,
            attempt_number,
            status,
            started_at,
            pgboss_started_at
        )
        VALUES (
            ${executionId}::uuid,
            ${jobId}::uuid,
            ${queueName},
            ${attemptNumber},
            ${options.executionStatus ?? 'running'}::public.scheduled_job_execution_status,
            NOW() - ${ageMinutes} * INTERVAL '1 minute',
            NOW() - ${startedAgeMinutes} * INTERVAL '1 minute'
        )
    `;

	return { jobId, executionId };
}

async function getExecution(executionId: string) {
	const [execution] = await client`
        SELECT
            id,
            status,
            completed_at,
            message,
            error_details
        FROM public.scheduled_job_executions
        WHERE id = ${executionId}::uuid
    `;

	return execution;
}

describe('reconcileInterruptedExecutions', () => {
	const fixtures: Fixture[] = [];

	beforeAll(async () => {
		await boss.start();

		await boss.createQueue(queueName);
	});

	afterAll(async () => {
		// Nettoyage ciblé : aucune donnée métier n'est supprimée.
		for (const fixture of fixtures) {
			await client`
                DELETE FROM public.scheduled_job_executions
                WHERE id = ${fixture.executionId}::uuid
            `;

			await client`
                DELETE FROM pgboss.job
                WHERE id = ${fixture.jobId}::uuid
            `;
		}
		await boss.stop();
		await client.end();
	});

	async function fixture(
		state: Parameters<typeof createFixture>[0],
		options?: Parameters<typeof createFixture>[1]
	) {
		const result = await createFixture(state, options);
		fixtures.push(result);
		return result;
	}

	it('marks an abandoned failed job as interrupted', async () => {
		const execution = await fixture('failed');

		const result = await reconcileInterruptedExecutions(client);
		const row = await getExecution(execution.executionId);

		expect(result.abandonedJobs).toBeGreaterThanOrEqual(1);
		expect(row.status).toBe('interrupted');
		expect(row.completed_at).not.toBeNull();
	});

	it('marks an abandoned retry job as interrupted', async () => {
		const execution = await fixture('retry');

		await reconcileInterruptedExecutions(client);

		const row = await getExecution(execution.executionId);

		expect(row.status).toBe('interrupted');
	});

	it('marks an old attempt as interrupted when a newer attempt is active', async () => {
		const execution = await fixture('active', {
			retryCount: 1,
			attemptNumber: 1,
			ageMinutes: 10,
			pgbossStartedAgeMinutes: 1
		});

		const result = await reconcileInterruptedExecutions(client);
		const row = await getExecution(execution.executionId);

		expect(result.supersededAttempts).toBeGreaterThanOrEqual(1);
		expect(row.status).toBe('interrupted');
	});

	it('does not interrupt the currently active attempt', async () => {
		const execution = await fixture('active', {
			retryCount: 0,
			attemptNumber: 1,
			ageMinutes: 10
		});

		await reconcileInterruptedExecutions(client);

		const row = await getExecution(execution.executionId);

		expect(row.status).toBe('running');
	});

	it('does not interrupt a recent execution', async () => {
		const execution = await fixture('failed', {
			ageMinutes: 0
		});

		await reconcileInterruptedExecutions(client);

		const row = await getExecution(execution.executionId);

		expect(row.status).toBe('running');
	});

	it('does not modify completed executions', async () => {
		const execution = await fixture('failed', {
			executionStatus: 'completed'
		});

		await reconcileInterruptedExecutions(client);

		const row = await getExecution(execution.executionId);

		expect(row.status).toBe('completed');
	});

	it('is idempotent', async () => {
		const execution = await fixture('failed');

		await reconcileInterruptedExecutions(client);
		const secondResult = await reconcileInterruptedExecutions(client);

		const row = await getExecution(execution.executionId);

		expect(row.status).toBe('interrupted');
		expect(secondResult.abandonedJobs).toBe(0);
		expect(secondResult.supersededAttempts).toBe(0);
	});

	it('marks an abandoned completed job as interrupted', async () => {
		const execution = await fixture('completed', {
			retryCount: 0,
			attemptNumber: 1,
			ageMinutes: 10
		});

		const result = await reconcileInterruptedExecutions(client);
		const row = await getExecution(execution.executionId);

		expect(result.abandonedJobs).toBeGreaterThanOrEqual(1);
		expect(row.status).toBe('interrupted');
		expect(row.completed_at).not.toBeNull();
	});

	it('marks an old attempt as interrupted when a newer attempt has completed', async () => {
		const execution = await fixture('completed', {
			retryCount: 1,
			attemptNumber: 1,
			ageMinutes: 10,
			pgbossStartedAgeMinutes: 1
		});

		const result = await reconcileInterruptedExecutions(client);
		const row = await getExecution(execution.executionId);

		expect(result.supersededAttempts).toBeGreaterThanOrEqual(1);
		expect(row.status).toBe('interrupted');
		expect(row.message).toBe('Execution superseded by a new attempt');
	});

	it('does not interrupt a recent completed job execution', async () => {
		const execution = await fixture('completed', {
			retryCount: 0,
			attemptNumber: 1,
			ageMinutes: 0
		});

		await reconcileInterruptedExecutions(client);

		const row = await getExecution(execution.executionId);

		expect(row.status).toBe('running');
	});
});
