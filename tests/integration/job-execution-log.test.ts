import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { createDb } from '../../src/lib/server/db/client.ts';
import { scheduledJobExecutions } from '../../src/lib/server/db/schema.ts';
import { createJobExecutionLogger } from '../../src/lib/server/jobs/execution-log.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is required for integration tests');
}

const { db, client } = createDb(connectionString);
const withJobExecutionLog = createJobExecutionLogger(db, client);

const JOB_NAME = 'test.execution-log';

describe('Job execution logging integration', () => {
	beforeAll(async () => {
		// Vérifie que la connexion à la base de test fonctionne.
		await client`SELECT 1`;
	});

	beforeEach(async () => {
		// Nettoyage limité aux jobs créés par cette suite.
		await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobName, JOB_NAME));
	});

	afterAll(async () => {
		await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobName, JOB_NAME));

		await client.end();
	});

	it('records a successful execution', async () => {
		const jobId = randomUUID();

		await withJobExecutionLog({ jobId, jobName: JOB_NAME }, async () => ({
			processedCount: 10,
			successCount: 10,
			failureCount: 0,
			message: 'All items processed'
		}));

		const executions = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(executions).toHaveLength(1);

		const execution = executions[0];

		expect(execution.status).toBe('completed');
		expect(execution.processedCount).toBe(10);
		expect(execution.successCount).toBe(10);
		expect(execution.failureCount).toBe(0);
		expect(execution.message).toBe('All items processed');
		expect(execution.completedAt).toBeInstanceOf(Date);
		expect(execution.errorDetails).toBeNull();
	});

	it('records a failed execution and rethrows the error', async () => {
		const jobId = randomUUID();

		await expect(
			withJobExecutionLog({ jobId, jobName: JOB_NAME }, async () => {
				throw new Error('Simulated processing failure');
			})
		).rejects.toThrow('Simulated processing failure');

		const executions = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(executions).toHaveLength(1);

		const execution = executions[0];

		expect(execution.status).toBe('failed');
		expect(execution.completedAt).toBeInstanceOf(Date);
		expect(execution.errorDetails).toContain('Simulated processing failure');
	});

	it('records a partial execution', async () => {
		const jobId = randomUUID();

		await withJobExecutionLog({ jobId, jobName: JOB_NAME }, async () => ({
			processedCount: 10,
			successCount: 7,
			failureCount: 3,
			message: '3 items failed'
		}));

		const executions = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(executions).toHaveLength(1);

		const execution = executions[0];

		expect(execution.status).toBe('partial');
		expect(execution.processedCount).toBe(10);
		expect(execution.successCount).toBe(7);
		expect(execution.failureCount).toBe(3);
		expect(execution.message).toBe('3 items failed');
		expect(execution.completedAt).toBeInstanceOf(Date);
	});

	it('records separate executions for repeated attempts', async () => {
		const jobId = randomUUID();

		await expect(
			withJobExecutionLog({ jobId, jobName: JOB_NAME }, async () => {
				throw new Error('First attempt failed');
			})
		).rejects.toThrow('First attempt failed');

		await withJobExecutionLog({ jobId, jobName: JOB_NAME }, async () => ({
			processedCount: 1,
			successCount: 1,
			failureCount: 0,
			message: 'Retry succeeded'
		}));

		const executions = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(executions).toHaveLength(2);

		expect(executions.map((execution) => execution.status).sort()).toEqual(['completed', 'failed']);
	});

	it('records a fully successful subscription reconciliation', async () => {
		const jobId = randomUUID();

		await withJobExecutionLog(
			{
				jobId,
				jobName: 'donations.reconcile-subscriptions',
				attemptNumber: 1
			},
			async () => ({
				processedCount: 10,
				successCount: 10,
				failureCount: 0,
				message: 'Subscriptions reconciled: 10 successful, 0 failed',
				errorDetails: null
			})
		);
		const [execution] = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(execution).toBeDefined();
		expect(execution.status).toBe('completed');
		expect(execution.processedCount).toBe(10);
		expect(execution.successCount).toBe(10);
		expect(execution.failureCount).toBe(0);
		expect(execution.errorDetails).toBeNull();
		expect(execution.completedAt).not.toBeNull();
	});

	it('records partial subscription reconciliation failures', async () => {
		const jobId = randomUUID();

		const errorDetails = ['sub_2: Mollie API timeout', 'sub_7: Subscription not found'].join('\n');

		await withJobExecutionLog(
			{
				jobId,
				jobName: 'donations.reconcile-subscriptions',
				attemptNumber: 1
			},
			async () => ({
				processedCount: 10,
				successCount: 8,
				failureCount: 2,
				message: 'Subscriptions reconciled: 8 successful, 2 failed',
				errorDetails
			})
		);

		const [execution] = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(execution).toBeDefined();
		expect(execution.status).toBe('partial');

		expect(execution.processedCount).toBe(10);
		expect(execution.successCount).toBe(8);
		expect(execution.failureCount).toBe(2);

		expect(execution.errorDetails).toBe(errorDetails);
		expect(execution.completedAt).not.toBeNull();
	});

	it('records a reconciliation where all subscriptions fail', async () => {
		const jobId = randomUUID();

		await withJobExecutionLog(
			{
				jobId,
				jobName: 'donations.reconcile-subscriptions',
				attemptNumber: 1
			},
			async () => ({
				processedCount: 10,
				successCount: 0,
				failureCount: 10,
				message: 'Subscriptions reconciled: 0 successful, 10 failed',
				errorDetails: 'Mollie API unavailable'
			})
		);

		const [execution] = await db
			.select()
			.from(scheduledJobExecutions)
			.where(eq(scheduledJobExecutions.jobId, jobId));

		expect(execution).toBeDefined();
		expect(execution.status).toBe('failed');

		expect(execution.processedCount).toBe(10);
		expect(execution.successCount).toBe(0);
		expect(execution.failureCount).toBe(10);

		expect(execution.errorDetails).toBe('Mollie API unavailable');
		expect(execution.completedAt).not.toBeNull();
	});
});
