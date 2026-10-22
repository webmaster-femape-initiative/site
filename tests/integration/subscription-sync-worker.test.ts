import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PgBoss } from 'pg-boss';
import { and, eq } from 'drizzle-orm';

import { randomUUID } from 'node:crypto';

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

// File réservée aux tests d'intégration.
const QUEUE_NAME = 'test.donations.sync-subscription';

function deferred<T>() {
	let resolve!: (value: T) => void;

	const promise = new Promise<T>((res) => {
		resolve = res;
	});

	return { promise, resolve };
}

describe('subscription synchronization pg-boss worker', () => {
	let boss: PgBoss;
	let fixture: RecurringDonationFixture;

	let jobId: string | null = null;

	const withJobExecutionLog = createJobExecutionLogger(db, client);

	beforeAll(async () => {
		fixture = await createRecurringDonationFixture({
			withMollieSubscription: true
		});

		boss = new PgBoss({
			connectionString
		});

		await boss.start();
		await boss.createQueue(QUEUE_NAME);
	});

	afterAll(async () => {
		try {
			if (boss) {
				await boss.stop();
			}

			// Supprimer uniquement les traces du job créé
			// par cette suite, sans toucher aux autres tests.
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

	it('processes and logs a successful subscription synchronization', async () => {
		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		const snapshot: MollieSubscriptionSnapshot = {
			id: subscriptionId,
			status: 'active',
			metadata: {
				donationId
			}
		};

		const getSubscription = vi.fn(async () => snapshot);

		const withLock = createSubscriptionLock(client);

		const synchronize = createSubscriptionSynchronizer(db, getSubscription, withLock);

		const processJob = createSyncSubscriptionJob(synchronize);

		// Permet d'attendre explicitement la fin du traitement.
		let resolveProcessed!: () => void;
		let rejectProcessed!: (reason?: unknown) => void;

		const processed = new Promise<void>((resolve, reject) => {
			resolveProcessed = resolve;
			rejectProcessed = reject;
		});

		// Enregistrer le consommateur pg-boss.
		await boss.work(QUEUE_NAME, async (jobs) => {
			try {
				for (const job of jobs) {
					await withJobExecutionLog(
						{
							jobId: job.id,
							jobName: QUEUE_NAME,
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

				resolveProcessed();
			} catch (error) {
				rejectProcessed(error);

				// Propager l'erreur à pg-boss.
				throw error;
			}
		});

		// Envoyer un véritable job dans la file.
		jobId = await boss.send(QUEUE_NAME, { subscriptionId });

		expect(jobId).toBeTruthy();

		// Attendre la fin du traitement.
		await processed;

		expect(getSubscription).toHaveBeenCalledTimes(1);

		// Vérifier la synchronisation du don.
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

		// Vérifier l'enregistrement de l'exécution.
		const executions = await db
			.select()
			.from(scheduledJobExecutions)
			.where(
				and(
					eq(scheduledJobExecutions.jobId, jobId!),
					eq(scheduledJobExecutions.jobName, QUEUE_NAME)
				)
			);

		expect(executions).toHaveLength(1);

		const execution = executions[0];

		expect(execution.status).toBe('completed');

		expect(execution.processedCount).toBe(1);
		expect(execution.successCount).toBe(1);
		expect(execution.failureCount).toBe(0);

		expect(execution.startedAt).toBeInstanceOf(Date);
		expect(execution.completedAt).toBeInstanceOf(Date);

		expect(execution.completedAt!.getTime()).toBeGreaterThanOrEqual(execution.startedAt.getTime());

		expect(execution.errorDetails).toBeNull();

		// Vérifier les métadonnées pg-boss.
		expect(execution.jobId).toBe(jobId);
		expect(execution.jobName).toBe(QUEUE_NAME);

		expect(execution.attemptNumber).toBeGreaterThanOrEqual(0);
	}, 30_000);

	it('logs already_running as completed without calling Mollie', async () => {
		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		const getSubscription = vi.fn(async (): Promise<MollieSubscriptionSnapshot> => ({
			id: subscriptionId,
			status: 'active',
			metadata: { donationId }
		}));

		const synchronize = createSubscriptionSynchronizer(
			db,
			getSubscription,
			createSubscriptionLock(client)
		);

		const processJob = createSyncSubscriptionJob(synchronize);

		// Connexion distincte : elle conserve le verrou pendant
		// que le job pg-boss tente de synchroniser l'abonnement.
		const lockHolder = createDb(connectionString);
		const withExternalLock = createSubscriptionLock(lockHolder.client);

		const lockAcquired = deferred<void>();
		const releaseLock = deferred<void>();

		let testJobId: string | null = null;

		// File dédiée pour éviter toute interaction avec
		// le consommateur du premier test.
		const queueName = `test.sync.locked.${randomUUID()}`;

		try {
			await boss.createQueue(queueName);

			const holdingLock = withExternalLock(subscriptionId, async () => {
				lockAcquired.resolve();
				await releaseLock.promise;
			});

			try {
				await lockAcquired.promise;

				const processed = new Promise<void>((resolve, reject) => {
					void boss
						.work(queueName, async (jobs) => {
							try {
								for (const job of jobs) {
									await withJobExecutionLog(
										{
											jobId: job.id,
											jobName: queueName,
											attemptNumber: job.retryCount
										},
										() => processJob(job.data as { subscriptionId: string })
									);
								}

								resolve();
							} catch (error) {
								reject(error);
								throw error;
							}
						})
						.catch(reject);
				});

				testJobId = await boss.send(queueName, { subscriptionId });

				expect(testJobId).toBeTruthy();

				await processed;

				// Le verrou externe empêche l'appel à Mollie.
				expect(getSubscription).not.toHaveBeenCalled();

				const executions = await db
					.select()
					.from(scheduledJobExecutions)
					.where(
						and(
							eq(scheduledJobExecutions.jobId, testJobId!),
							eq(scheduledJobExecutions.jobName, queueName)
						)
					);

				expect(executions).toHaveLength(1);

				const execution = executions[0];

				expect(execution.status).toBe('completed');
				expect(execution.processedCount).toBe(1);
				expect(execution.successCount).toBe(0);
				expect(execution.failureCount).toBe(0);
				expect(execution.completedAt).toBeInstanceOf(Date);
				expect(execution.errorDetails).toBeNull();

				expect(execution.message).toBe('Subscription synchronization already running');
			} finally {
				releaseLock.resolve();
				await holdingLock;
			}
		} finally {
			if (testJobId) {
				await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, testJobId));
			}

			await lockHolder.client.end();
		}
	}, 30_000);

	it('logs superseded as completed without overwriting a newer status', async () => {
		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		// Réinitialiser le statut sans remettre le compteur
		// de génération à zéro.
		await db
			.update(donations)
			.set({
				mollieSubscriptionStatus: 'pending',
				mollieSubscriptionSyncedAt: null
			})
			.where(eq(donations.id, donationId));

		const enteredMollie = deferred<void>();
		const releaseMollie = deferred<void>();

		// Ce verrou injectable permet de simuler la perte
		// du verrou consultatif PostgreSQL.
		//
		// Le test porte ici sur le fencing, et non sur
		// le fonctionnement normal du verrou.
		const withoutLock = async <T>(_subscriptionId: string, handler: () => Promise<T>) => ({
			acquired: true as const,
			result: await handler()
		});

		const getSubscriptionA = vi.fn(async (): Promise<MollieSubscriptionSnapshot> => {
			enteredMollie.resolve();

			await releaseMollie.promise;

			return {
				id: subscriptionId,
				status: 'suspended',
				metadata: { donationId }
			};
		});

		const getSubscriptionB = vi.fn(async (): Promise<MollieSubscriptionSnapshot> => ({
			id: subscriptionId,
			status: 'active',
			metadata: { donationId }
		}));

		const syncA = createSubscriptionSynchronizer(db, getSubscriptionA, withoutLock);

		const syncB = createSubscriptionSynchronizer(db, getSubscriptionB, withoutLock);

		const processJobA = createSyncSubscriptionJob(syncA);

		const queueName = `test.sync.superseded.${randomUUID()}`;

		let testJobId: string | null = null;

		// Permet d'attendre la fin du traitement pg-boss.
		const processed = deferred<void>();

		try {
			await boss.createQueue(queueName);

			await boss.work(queueName, async (jobs) => {
				for (const job of jobs) {
					await withJobExecutionLog(
						{
							jobId: job.id,
							jobName: queueName,
							attemptNumber: job.retryCount
						},
						() => processJobA(job.data as { subscriptionId: string })
					);
				}

				processed.resolve();
			});
			testJobId = await boss.send(queueName, { subscriptionId });

			expect(testJobId).toBeTruthy();

			try {
				// A a réservé sa génération et attend Mollie.
				await enteredMollie.promise;

				// B réserve une génération plus récente et
				// enregistre son résultat avant A.
				const secondResult = await syncB(subscriptionId);

				expect(secondResult).toBe('updated');

				const [afterB] = await db
					.select({
						status: donations.mollieSubscriptionStatus
					})
					.from(donations)
					.where(eq(donations.id, donationId))
					.limit(1);

				expect(afterB.status).toBe('active');
			} finally {
				// Toujours débloquer A.
				releaseMollie.resolve();
			}

			// A doit terminer sans erreur technique.
			await processed.promise;

			expect(getSubscriptionA).toHaveBeenCalledTimes(1);
			expect(getSubscriptionB).toHaveBeenCalledTimes(1);

			// Vérifier que le statut récent est conservé.
			const [finalDonation] = await db
				.select({
					status: donations.mollieSubscriptionStatus,
					generation: donations.mollieSubscriptionSyncGeneration,
					syncedAt: donations.mollieSubscriptionSyncedAt
				})
				.from(donations)
				.where(eq(donations.id, donationId))
				.limit(1);

			expect(finalDonation.status).toBe('active');
			expect(finalDonation.generation).toBeGreaterThanOrEqual(2);
			expect(finalDonation.syncedAt).toBeInstanceOf(Date);

			// Vérifier la journalisation du job obsolète.
			const executions = await db
				.select()
				.from(scheduledJobExecutions)
				.where(
					and(
						eq(scheduledJobExecutions.jobId, testJobId!),
						eq(scheduledJobExecutions.jobName, queueName)
					)
				);

			expect(executions).toHaveLength(1);

			const execution = executions[0];

			expect(execution.status).toBe('completed');
			expect(execution.processedCount).toBe(1);
			expect(execution.successCount).toBe(0);
			expect(execution.failureCount).toBe(0);

			expect(execution.completedAt).toBeInstanceOf(Date);
			expect(execution.errorDetails).toBeNull();

			expect(execution.message).toBe(
				'Subscription synchronization superseded by a newer execution'
			);
		} finally {
			// Éviter de laisser un appel Mollie simulé en attente
			// lorsqu'une assertion échoue.
			releaseMollie.resolve();

			if (testJobId) {
				await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, testJobId));
			}
		}
	}, 30_000);

	it('retries a transient Mollie error and logs both attempts', async () => {
		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		// Réinitialiser le statut, sans réinitialiser
		// le compteur de génération.
		await db
			.update(donations)
			.set({
				mollieSubscriptionStatus: 'pending',
				mollieSubscriptionSyncedAt: null
			})
			.where(eq(donations.id, donationId));

		const queueName = `test.sync.retry.${randomUUID()}`;

		const completed = deferred<void>();
		let jobId: string | null = null;

		const getSubscription = vi.fn(async (): Promise<MollieSubscriptionSnapshot> => {
			if (getSubscription.mock.calls.length === 1) {
				// Erreur réseau transitoire.
				// Le synchroniseur doit la propager.
				const error = new Error('Mollie API temporarily unavailable');
				error.name = 'TimeoutError';
				throw error;
			}

			return {
				id: subscriptionId,
				status: 'active',
				metadata: { donationId }
			};
		});

		const synchronize = createSubscriptionSynchronizer(
			db,
			getSubscription,
			createSubscriptionLock(client)
		);

		const processJob = createSyncSubscriptionJob(synchronize);

		try {
			await boss.createQueue(queueName, {
				retryLimit: 2,
				retryDelay: 1,
				retryBackoff: false
			});

			await boss.work(queueName, async (jobs) => {
				for (const job of jobs) {
					await withJobExecutionLog(
						{
							jobId: job.id,
							jobName: queueName,
							attemptNumber: job.retryCount
						},
						() => processJob(job.data as { subscriptionId: string })
					);

					// La promesse n'est résolue que si le
					// traitement s'est terminé sans exception.
					completed.resolve();
				}
			});

			jobId = await boss.send(queueName, { subscriptionId });

			expect(jobId).toBeTruthy();

			// La première tentative échoue, puis pg-boss
			// programme automatiquement une seconde tentative.
			await completed.promise;

			expect(getSubscription).toHaveBeenCalledTimes(2);

			const [donation] = await db
				.select({
					status: donations.mollieSubscriptionStatus,
					syncedAt: donations.mollieSubscriptionSyncedAt
				})
				.from(donations)
				.where(eq(donations.id, donationId))
				.limit(1);

			expect(donation.status).toBe('active');
			expect(donation.syncedAt).toBeInstanceOf(Date);

			const executions = await db
				.select()
				.from(scheduledJobExecutions)
				.where(
					and(
						eq(scheduledJobExecutions.jobId, jobId!),
						eq(scheduledJobExecutions.jobName, queueName)
					)
				)
				.orderBy(scheduledJobExecutions.startedAt);

			expect(executions).toHaveLength(2);

			const [firstAttempt, secondAttempt] = executions;

			// Première tentative : erreur transitoire.
			expect(firstAttempt.status).toBe('failed');
			expect(firstAttempt.completedAt).toBeInstanceOf(Date);
			expect(firstAttempt.errorDetails).toContain('Mollie API temporarily unavailable');

			// Deuxième tentative : synchronisation réussie.
			expect(secondAttempt.status).toBe('completed');
			expect(secondAttempt.processedCount).toBe(1);
			expect(secondAttempt.successCount).toBe(1);
			expect(secondAttempt.failureCount).toBe(0);
			expect(secondAttempt.errorDetails).toBeNull();

			// Même job pg-boss, mais deux tentatives distinctes.
			expect(firstAttempt.jobId).toBe(jobId);
			expect(secondAttempt.jobId).toBe(jobId);

			expect(firstAttempt.attemptNumber).not.toBeNull();
			expect(secondAttempt.attemptNumber).not.toBeNull();

			expect(secondAttempt.attemptNumber).toBeGreaterThan(firstAttempt.attemptNumber!);
		} finally {
			if (jobId) {
				await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, jobId));
			}
		}
	}, 45_000);

	it('does not retry a permanent Mollie error', async () => {
		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		const queueName = `test.sync.permanent.${randomUUID()}`;
		const completed = deferred<void>();

		let jobId: string | null = null;

		const getSubscription = vi.fn(async () => {
			const error = new Error('Mollie API unauthorized');

			Object.assign(error, {
				statusCode: 401
			});

			throw error;
		});

		const synchronize = createSubscriptionSynchronizer(
			db,
			getSubscription,
			createSubscriptionLock(client)
		);

		const processJob = createSyncSubscriptionJob(synchronize);

		try {
			await boss.createQueue(queueName, {
				retryLimit: 2,
				retryDelay: 1,
				retryBackoff: false
			});

			await boss.work(queueName, async (jobs) => {
				for (const job of jobs) {
					await withJobExecutionLog(
						{
							jobId: job.id,
							jobName: queueName,
							attemptNumber: job.retryCount
						},
						() => processJob(job.data as { subscriptionId: string })
					);

					completed.resolve();
				}
			});

			jobId = await boss.send(queueName, { subscriptionId });

			expect(jobId).toBeTruthy();

			await completed.promise;

			expect(getSubscription).toHaveBeenCalledTimes(1);

			const executions = await db
				.select()
				.from(scheduledJobExecutions)
				.where(eq(scheduledJobExecutions.jobId, jobId!));

			expect(executions).toHaveLength(1);

			const execution = executions[0];

			expect(execution.status).toBe('failed');
			expect(execution.attemptNumber).toBe(1);

			expect(execution.processedCount).toBe(1);
			expect(execution.successCount).toBe(0);
			expect(execution.failureCount).toBe(1);

			expect(execution.message).toBe(`Subscription ${subscriptionId} synchronization failed`);

			expect(execution.errorDetails).toContain('[configuration/unauthorized]');

			expect(execution.completedAt).toBeInstanceOf(Date);

			// Une erreur 401 ne doit pas modifier
			// le statut de l'abonnement.
			const [donation] = await db
				.select({
					status: donations.mollieSubscriptionStatus
				})
				.from(donations)
				.where(eq(donations.id, donationId))
				.limit(1);

			expect(donation.status).toBe('active');
		} finally {
			if (jobId) {
				await db.delete(scheduledJobExecutions).where(eq(scheduledJobExecutions.jobId, jobId));
			}
		}
	}, 30_000);
});
