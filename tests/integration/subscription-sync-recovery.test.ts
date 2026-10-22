import { afterAll, describe, expect, it, vi } from 'vitest';

import { PgBoss } from 'pg-boss';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { reconcileInterruptedExecutions } from '../../src/lib/server/jobs/reconcile-executions.ts';

import { createDb } from '../../src/lib/server/db/client.ts';

import { donations, scheduledJobExecutions } from '../../src/lib/server/db/schema.ts';

import {
	createSubscriptionSynchronizer,
	type MollieSubscriptionSnapshot
} from '../../src/lib/server/donations/subscription-sync-core.ts';

import { createSubscriptionLock } from '../../src/lib/server/donations/subscription-sync-lock.ts';

import { createSyncSubscriptionJob } from '../../src/lib/server/jobs/donations/sync-subscription.ts';

import { createJobExecutionLogger } from '../../src/lib/server/jobs/execution-log.ts';

import {
	createRecurringDonationFixture,
	type RecurringDonationFixture
} from '../fixtures/recurring-donations';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const { db, client } = createDb(connectionString);

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

type WorkerMessage = { type: 'worker-ready' } | { type: 'mollie-call-started' };

function waitForWorkerMessage(
	worker: ChildProcess,
	expectedType: WorkerMessage['type'],
	timeoutMs = 15_000
): Promise<void> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			cleanup();
			reject(new Error(`Timeout waiting for ${expectedType}`));
		}, timeoutMs);

		function onMessage(message: WorkerMessage) {
			if (message?.type === expectedType) {
				cleanup();
				resolve();
			}
		}

		function onExit(code: number | null, signal: string | null) {
			cleanup();
			reject(new Error(`Worker exited before ${expectedType}: ${code}/${signal}`));
		}

		function cleanup() {
			clearTimeout(timeout);
			worker.off('message', onMessage);
			worker.off('exit', onExit);
		}

		worker.on('message', onMessage);
		worker.once('exit', onExit);
	});
}

async function waitUntil(
	predicate: () => Promise<boolean>,
	timeoutMs = 30_000,
	intervalMs = 250
): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		if (await predicate()) return;

		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	throw new Error('Condition not reached before timeout');
}

function startCrashableWorker(queueName: string, connectionString: string): ChildProcess {
	const workerPath = fileURLToPath(
		new URL('../helpers/crashable-subscription-worker.ts', import.meta.url)
	);

	return fork(workerPath, [], {
		execArgv: ['--import', 'tsx'],
		env: {
			...process.env,
			DATABASE_URL: connectionString,
			TEST_QUEUE_NAME: queueName
		},
		stdio: ['ignore', 'inherit', 'inherit', 'ipc']
	});
}

describe('subscription synchronization pg-boss recovery', () => {
	let fixture: RecurringDonationFixture | null = null;
	let producer: PgBoss | null = null;
	let consumer: PgBoss | null = null;

	let jobId: string | null = null;

	const queueName = `test.sync.recovery.${randomUUID()}`;

	const withJobExecutionLog = createJobExecutionLogger(db, client);

	afterAll(async () => {
		try {
			if (consumer) {
				await consumer.stop();
			}

			if (producer) {
				await producer.stop();
			}

			if (jobId) {
				await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, jobId));
			}

			if (fixture) {
				await fixture.cleanup();
			}
		} finally {
			await client.end();
		}
	});

	it('processes a pending subscription job after pg-boss restart', async () => {
		fixture = await createRecurringDonationFixture({
			withMollieSubscription: true
		});

		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		const snapshot: MollieSubscriptionSnapshot = {
			id: subscriptionId,
			status: 'active',
			metadata: { donationId }
		};

		const getSubscription = vi.fn(async () => snapshot);

		const synchronize = createSubscriptionSynchronizer(
			db,
			getSubscription,
			createSubscriptionLock(client)
		);

		const processJob = createSyncSubscriptionJob(synchronize);

		// -----------------------------------------
		// Étape 1 : démarrage du premier pg-boss
		// -----------------------------------------

		producer = new PgBoss({ connectionString });

		await producer.start();

		await producer.createQueue(queueName);

		// Aucun consommateur n'est enregistré.
		jobId = await producer.send(queueName, {
			subscriptionId
		});

		expect(jobId).toBeTruthy();

		// Le job existe, mais Mollie n'a pas encore
		// été appelé.
		expect(getSubscription).not.toHaveBeenCalled();

		// -----------------------------------------
		// Étape 2 : arrêt de la première instance
		// -----------------------------------------

		await producer.stop();
		producer = null;

		expect(getSubscription).not.toHaveBeenCalled();

		// -----------------------------------------
		// Étape 3 : démarrage d'une nouvelle instance
		// -----------------------------------------

		consumer = new PgBoss({ connectionString });

		await consumer.start();

		const processed = deferred<void>();

		await consumer.work(queueName, async (jobs) => {
			try {
				for (const job of jobs) {
					await withJobExecutionLog(
						{
							jobId: job.id,
							jobName: queueName,
							attemptNumber: job.retryCount
						},
						() =>
							processJob(
								job.data as {
									subscriptionId: string;
								}
							)
					);
				}

				processed.resolve();
			} catch (error) {
				processed.reject(error);
				throw error;
			}
		});

		// -----------------------------------------
		// Étape 4 : attendre la reprise du job
		// -----------------------------------------

		await processed.promise;

		expect(getSubscription).toHaveBeenCalledTimes(1);

		// -----------------------------------------
		// Étape 5 : vérifier l'état de l'abonnement
		// -----------------------------------------

		const [donation] = await db
			.select({
				status: donations.mollieSubscriptionStatus,
				syncedAt: donations.mollieSubscriptionSyncedAt
			})
			.from(donations)
			.where(eq(donations.id, donationId))
			.limit(1);

		expect(donation).toBeDefined();
		expect(donation.status).toBe('active');
		expect(donation.syncedAt).toBeInstanceOf(Date);

		// -----------------------------------------
		// Étape 6 : vérifier la journalisation
		// -----------------------------------------

		const executions = await db
			.select()
			.from(scheduledJobExecutions)
			.where(
				and(eq(scheduledJobExecutions.jobId, jobId!), eq(scheduledJobExecutions.jobName, queueName))
			);

		expect(executions).toHaveLength(1);

		const execution = executions[0];

		expect(execution.status).toBe('completed');

		expect(execution.processedCount).toBe(1);
		expect(execution.successCount).toBe(1);
		expect(execution.failureCount).toBe(0);

		expect(execution.attemptNumber).toBe(1);

		expect(execution.startedAt).toBeInstanceOf(Date);
		expect(execution.completedAt).toBeInstanceOf(Date);

		expect(execution.errorDetails).toBeNull();

		expect(execution.message).toBe(`Subscription ${subscriptionId} synchronized: updated`);

		// Le job repris conserve son identifiant initial.
		expect(execution.jobId).toBe(jobId);
		expect(execution.jobName).toBe(queueName);
	}, 45_000);

	it('recovers an active subscription job after a worker crash', async () => {
		const crashQueue = `test.sync.crash.${randomUUID()}`;

		const crashFixture = await createRecurringDonationFixture({
			withMollieSubscription: true
		});

		const subscriptionId = crashFixture.subscriptionId;

		if (!subscriptionId) {
			await crashFixture.cleanup();
			throw new Error('Missing subscription ID');
		}

		let crashedWorker: ChildProcess | null = null;
		let recoveryBoss: PgBoss | null = null;
		let crashJobId: string | null = null;

		try {
			// Une configuration courte pour les tests.
			recoveryBoss = new PgBoss({
				connectionString,
				maintenanceIntervalSeconds: 1
			});

			await recoveryBoss.start();

			await recoveryBoss.createQueue(crashQueue, {
				retryLimit: 2,
				retryDelay: 1,
				retryBackoff: false,
				expireInSeconds: 5
			});

			// Le processus enfant récupérera le job.
			crashedWorker = startCrashableWorker(crashQueue, connectionString);

			await waitForWorkerMessage(crashedWorker, 'worker-ready');

			// Installer l'écouteur avant l'envoi.
			const mollieStarted = waitForWorkerMessage(crashedWorker, 'mollie-call-started');

			crashJobId = await recoveryBoss.send(crashQueue, {
				subscriptionId
			});

			expect(crashJobId).toBeTruthy();

			await mollieStarted;

			// La première tentative doit être enregistrée.
			await waitUntil(async () => {
				const executions = await db
					.select()
					.from(scheduledJobExecutions)
					.where(eq(scheduledJobExecutions.jobId, crashJobId!));

				return executions.some((execution) => execution.status === 'running');
			});

			// Simulation d'un crash brutal.
			const exited = new Promise<void>((resolve) => {
				crashedWorker!.once('exit', () => resolve());
			});

			crashedWorker.kill('SIGKILL');
			await exited;
			crashedWorker = null;

			// Le second worker doit reprendre le job.
			const getSubscription = vi.fn(async (): Promise<MollieSubscriptionSnapshot> => ({
				id: subscriptionId,
				status: 'active',
				metadata: {
					donationId: crashFixture.donationId
				}
			}));

			const synchronize = createSubscriptionSynchronizer(
				db,
				getSubscription,
				createSubscriptionLock(client)
			);

			const processJob = createSyncSubscriptionJob(synchronize);
			const withJobExecutionLog = createJobExecutionLogger(db, client);

			const recovered = deferred<void>();

			await recoveryBoss.work(crashQueue, async ([job]) => {
				try {
					await withJobExecutionLog(
						{
							jobId: job.id,
							jobName: job.name,
							attemptNumber: job.retryCount + 1
						},
						() => processJob(job.data as { subscriptionId: string })
					);

					recovered.resolve();
				} catch (error) {
					recovered.reject(error);
					throw error;
				}
			});

			await recovered.promise;

			expect(getSubscription).toHaveBeenCalledTimes(1);

			const [donation] = await db
				.select({
					status: donations.mollieSubscriptionStatus
				})
				.from(donations)
				.where(eq(donations.id, crashFixture.donationId))
				.limit(1);

			expect(donation.status).toBe('active');

			// La période de grâce est de deux minutes.
			// Nous vieillissons uniquement la trace de test
			// afin de vérifier la réconciliation sans attendre.
			await client`
            UPDATE public.scheduled_job_executions
            SET started_at = NOW() - INTERVAL '3 minutes'
            WHERE job_id = ${crashJobId}::uuid
              AND status = 'running'
        `;

			await reconcileInterruptedExecutions(client);

			const executions = await db
				.select()
				.from(scheduledJobExecutions)
				.where(eq(scheduledJobExecutions.jobId, crashJobId!));

			expect(executions).toHaveLength(2);

			expect(
				executions.some(
					(execution) => execution.status === 'interrupted' && execution.attemptNumber === 1
				)
			).toBe(true);

			expect(
				executions.some(
					(execution) => execution.status === 'completed' && execution.attemptNumber === 2
				)
			).toBe(true);
		} finally {
			if (crashedWorker && crashedWorker.exitCode === null) {
				const worker = crashedWorker;
				const exited = new Promise<void>((resolve) => {
					worker.once('exit', () => resolve());
				});

				worker.kill('SIGKILL');
				await exited;
			}

			if (recoveryBoss) {
				await recoveryBoss.stop();
			}

			if (crashJobId) {
				await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, crashJobId));
			}

			await crashFixture.cleanup();
		}
	}, 90_000);
});
