import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';

import { createBoss } from '../../src/lib/server/jobs/boss.ts';
import { createDb } from '../../src/lib/server/db/client.ts';
import { createJobExecutionLogger } from '../../src/lib/server/jobs/execution-log.ts';

import { createSyncSubscriptionJob } from '../../src/lib/server/jobs/donations/sync-subscription.ts';

import type { SubscriptionSyncResult } from '../../src/lib/server/donations/subscription-sync-core.ts';

import { SubscriptionSyncValidationError } from '../../src/lib/server/donations/subscription-sync-errors.ts';

import { scheduledJobExecutions } from '../../src/lib/server/db/schema.ts';

type SyncSubscription = (subscriptionId: string) => Promise<SubscriptionSyncResult>;

type JobData = {
	subscriptionId: string;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const boss = createBoss(connectionString);
const { db, client } = createDb(connectionString);

const withJobExecutionLog = createJobExecutionLogger(db, client);

// Queue isolée pour cette exécution des tests.
const queueName = `test.sync-subscription.${randomUUID()}`;

// Chaque abonnement de test possède sa propre simulation.
const synchronizers = new Map<string, SyncSubscription>();

// Identifiants des jobs créés par cette suite.
const jobIds: string[] = [];

const RETRY_LIMIT = 2;
const TIMEOUT_MS = 60_000;

// ---------------------------------------------------------
// Synchroniseur simulé unique
// ---------------------------------------------------------

const syncSubscription: SyncSubscription = async (subscriptionId) => {
	const synchronizer = synchronizers.get(subscriptionId);

	if (!synchronizer) {
		throw new Error(`No test synchronizer registered for ${subscriptionId}`);
	}

	return synchronizer(subscriptionId);
};

const syncSubscriptionJob = createSyncSubscriptionJob(syncSubscription);

// ---------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------

async function waitFor<T>(
	read: () => Promise<T>,
	predicate: (value: T) => boolean,
	timeoutMs = TIMEOUT_MS
): Promise<T> {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		const value = await read();

		if (predicate(value)) {
			return value;
		}

		await new Promise<void>((resolve) => {
			setTimeout(resolve, 200);
		});
	}

	throw new Error(`Timed out waiting for pg-boss after ${timeoutMs} ms`);
}

async function getJobState(jobId: string) {
	const rows = await client<
		{
			state: string;
			retry_count: number;
		}[]
	>`
        SELECT state, retry_count
        FROM pgboss.job
        WHERE id = ${jobId}::uuid
    `;

	return rows[0] ?? null;
}

async function getExecutions(jobId: string) {
	return db
		.select()
		.from(scheduledJobExecutions)
		.where(
			and(eq(scheduledJobExecutions.jobId, jobId), eq(scheduledJobExecutions.jobName, queueName))
		)
		.orderBy(scheduledJobExecutions.attemptNumber);
}

async function sendTestJob(
	subscriptionId: string,
	synchronizer: SyncSubscription
): Promise<string> {
	synchronizers.set(subscriptionId, synchronizer);

	const jobId = await boss.send(queueName, {
		subscriptionId
	});

	if (!jobId) {
		throw new Error(`Failed to enqueue subscription ${subscriptionId}`);
	}

	jobIds.push(jobId);

	return jobId;
}

async function waitForJobState(jobId: string, expectedState: string) {
	return waitFor(
		() => getJobState(jobId),
		(job) => job?.state === expectedState
	);
}

// ---------------------------------------------------------
// Tests
// ---------------------------------------------------------

describe('donations.sync-subscription - pg-boss integration', () => {
	beforeAll(async () => {
		await boss.start();

		await boss.createQueue(queueName, {
			retryLimit: RETRY_LIMIT,
			retryDelay: 1,
			retryBackoff: false
		});

		// Un seul worker pour l'ensemble de la suite.
		await boss.work<JobData>(queueName, async ([job]) => {
			await withJobExecutionLog(
				{
					jobId: job.id,
					jobName: job.name,
					attemptNumber: job.retryCount + 1
				},
				() => syncSubscriptionJob(job.data)
			);
		});
	});

	afterAll(async () => {
		try {
			await boss.stop();
		} finally {
			// Suppression des journaux de cette suite uniquement.
			for (const jobId of jobIds) {
				await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, jobId));
			}

			synchronizers.clear();

			await client.end();
		}
	});

	it('completes a successful synchronization', async () => {
		const sync = vi.fn<SyncSubscription>().mockResolvedValue('updated');

		const jobId = await sendTestJob('sub_success', sync);

		const job = await waitForJobState(jobId, 'completed');

		expect(job?.state).toBe('completed');

		const executions = await getExecutions(jobId);

		expect(executions).toHaveLength(1);

		expect(executions[0]).toMatchObject({
			status: 'completed',
			attemptNumber: 1,
			processedCount: 1,
			successCount: 1,
			failureCount: 0
		});

		expect(sync).toHaveBeenCalledExactlyOnceWith('sub_success');
	});

	it('does not retry permanent validation errors', async () => {
		const sync = vi
			.fn<SyncSubscription>()
			.mockRejectedValue(
				new SubscriptionSyncValidationError('invalid_metadata', 'Donation ID mismatch')
			);

		const jobId = await sendTestJob('sub_invalid', sync);

		await waitForJobState(jobId, 'completed');

		const executions = await getExecutions(jobId);

		expect(executions).toHaveLength(1);

		expect(executions[0]).toMatchObject({
			status: 'partial',
			attemptNumber: 1,
			processedCount: 1,
			successCount: 0,
			failureCount: 1
		});

		expect(executions[0].errorDetails).toContain('invalid_metadata');

		expect(sync).toHaveBeenCalledTimes(1);
	});

	it('retries a transient error and eventually succeeds', async () => {
		const error = Object.assign(new Error('Mollie temporarily unavailable'), { status: 503 });

		const sync = vi
			.fn<SyncSubscription>()
			.mockRejectedValueOnce(error)
			.mockResolvedValueOnce('updated');

		const jobId = await sendTestJob('sub_retry', sync);

		await waitForJobState(jobId, 'completed');

		const executions = await getExecutions(jobId);

		expect(executions).toHaveLength(2);

		expect(executions.map((execution) => execution.attemptNumber)).toEqual([1, 2]);

		expect(executions.map((execution) => execution.status)).toEqual(['failed', 'completed']);

		expect(sync).toHaveBeenCalledTimes(2);
	}, 90_000);

	it('fails after exhausting all retries', async () => {
		const error = Object.assign(new Error('Mollie unavailable'), { status: 503 });

		const sync = vi.fn<SyncSubscription>().mockRejectedValue(error);

		const jobId = await sendTestJob('sub_failed', sync);

		await waitForJobState(jobId, 'failed');

		const executions = await getExecutions(jobId);

		expect(executions).toHaveLength(RETRY_LIMIT + 1);

		expect(executions.map((execution) => execution.attemptNumber)).toEqual([1, 2, 3]);

		expect(executions.every((execution) => execution.status === 'failed')).toBe(true);

		expect(sync).toHaveBeenCalledTimes(3);
	}, 90_000);
});
