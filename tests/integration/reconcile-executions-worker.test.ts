import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { createBoss } from '../../src/lib/server/jobs/boss.ts';
import { createDb } from '../../src/lib/server/db/client.ts';

import { scheduledJobExecutions } from '../../src/lib/server/db/schema.ts';

import { createJobExecutionLogger } from '../../src/lib/server/jobs/execution-log.ts';

import { createReconcileExecutionsJob } from '../../src/lib/server/jobs/handlers/reconcile-executions.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const { db, client } = createDb(connectionString);

const boss = createBoss(connectionString);

const queueName = `test.reconcile.worker.${randomUUID()}`;
const sourceQueueName = `test.reconcile.source.${randomUUID()}`;

type Fixture = {
	jobId: string;
	executionId: string;
};

const fixtures: Fixture[] = [];
const reconciliationJobIds: string[] = [];

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

async function createExecutionFixture(
	state: 'failed' | 'active',
	ageMinutes = 10
): Promise<Fixture> {
	const jobId = randomUUID();
	const executionId = randomUUID();

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
            ${sourceQueueName},
            ${state}::pgboss.job_state,
            '{}'::jsonb,
            0,
            NOW() - ${ageMinutes} * INTERVAL '1 minute'
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
            ${sourceQueueName},
            1,
            'running'::public.scheduled_job_execution_status,
            NOW() - ${ageMinutes} * INTERVAL '1 minute',
            NOW() - ${ageMinutes} * INTERVAL '1 minute'
        )
    `;

	const fixture = { jobId, executionId };
	fixtures.push(fixture);

	return fixture;
}

async function getExecution(executionId: string) {
	const [execution] = await client`
        SELECT
            status,
            completed_at,
            message,
            error_details
        FROM public.scheduled_job_executions
        WHERE id = ${executionId}::uuid
    `;

	return execution;
}

async function sendAndWait(): Promise<string> {
	const completed = deferred<void>();

	const jobId = await boss.send(queueName, {});

	if (!jobId) {
		throw new Error('pg-boss did not create a job');
	}

	reconciliationJobIds.push(jobId);

	// Le consommateur est enregistré avant l'envoi
	// dans beforeAll(). Le callback de résolution
	// sera installé via la map ci-dessous.
	pendingJobs.set(jobId, completed);

	await completed.promise;

	return jobId;
}

const pendingJobs = new Map<string, ReturnType<typeof deferred<void>>>();

describe('periodic execution reconciliation worker', () => {
	const withJobExecutionLog = createJobExecutionLogger(db, client);
	const reconcileExecutionsJob = createReconcileExecutionsJob(client);

	beforeAll(async () => {
		await boss.start();

		await boss.createQueue(queueName);
		await boss.createQueue(sourceQueueName);

		await boss.work(queueName, async ([job]) => {
			try {
				await withJobExecutionLog(
					{
						jobId: job.id,
						jobName: job.name,
						attemptNumber: job.retryCount + 1
					},
					() => reconcileExecutionsJob()
				);

				pendingJobs.get(job.id)?.resolve();
			} catch (error) {
				pendingJobs.get(job.id)?.reject(error);
				throw error;
			}
		});
	});

	afterAll(async () => {
		await boss.stop();

		for (const jobId of reconciliationJobIds) {
			await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, jobId));
		}

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

		await client.end();
	});

	it('reconciles abandoned executions and logs the result', async () => {
		const abandoned = await createExecutionFixture('failed');
		const active = await createExecutionFixture('active');

		const jobId = await sendAndWait();

		const abandonedRow = await getExecution(abandoned.executionId);
		const activeRow = await getExecution(active.executionId);

		expect(abandonedRow.status).toBe('interrupted');
		expect(abandonedRow.completed_at).not.toBeNull();

		expect(activeRow.status).toBe('running');

		const [execution] = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(execution).toBeDefined();
		expect(execution.status).toBe('completed');

		expect(execution.processedCount).toBe(1);
		expect(execution.successCount).toBe(1);
		expect(execution.failureCount).toBe(0);

		expect(execution.attemptNumber).toBe(1);

		expect(execution.message).toContain('1 abandoned, 0 superseded');
	}, 30_000);

	it('does not reconcile the same execution twice', async () => {
		const jobId = await sendAndWait();

		const [execution] = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(execution.status).toBe('completed');

		expect(execution.processedCount).toBe(0);
		expect(execution.successCount).toBe(0);
		expect(execution.failureCount).toBe(0);

		expect(execution.message).toContain('0 abandoned, 0 superseded');
	}, 30_000);
});
