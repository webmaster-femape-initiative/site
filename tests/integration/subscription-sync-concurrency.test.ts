import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { eq } from 'drizzle-orm';

import { createDb } from '../../src/lib/server/db/client.ts';
import { donations, donors } from '../../src/lib/server/db/schema.ts';

import {
	createSubscriptionSynchronizer,
	type MollieSubscriptionSnapshot
} from '../../src/lib/server/donations/subscription-sync-core.ts';

import { createSubscriptionLock } from '../../src/lib/server/donations/subscription-sync-lock.ts';

import {
	createRecurringDonationFixture,
	type RecurringDonationFixture
} from '../fixtures/recurring-donations';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

// Deux instances indépendantes du service.
const workerA = createDb(connectionString);
const workerB = createDb(connectionString);

const withLockA = createSubscriptionLock(workerA.client);
const withLockB = createSubscriptionLock(workerB.client);

function deferred<T>() {
	let resolve!: (value: T) => void;

	const promise = new Promise<T>((res) => {
		resolve = res;
	});

	return { promise, resolve };
}

describe('subscription synchronization concurrency', () => {
	let fixture: RecurringDonationFixture;

	beforeAll(async () => {
		fixture = await createRecurringDonationFixture({
			withMollieSubscription: true
		});
	});

	afterAll(async () => {
		try {
			if (fixture) {
				await fixture.cleanup();
			}
		} finally {
			await Promise.all([workerA.client.end(), workerB.client.end()]);
		}
	});

	async function resetSubscriptionStatus() {
		await workerA.db
			.update(donations)
			.set({
				mollieSubscriptionStatus: 'pending',
				mollieSubscriptionSyncedAt: null
			})
			.where(eq(donations.id, fixture.donationId));
	}

	it('prevents concurrent synchronization of the same subscription', async () => {
		const { donationId, subscriptionId, customerId } = fixture;

		if (!subscriptionId || !customerId) {
			throw new Error('Mollie subscription fixture is not initialized');
		}

		// Vérifier que les données de test sont correctement créées.
		const [donation] = await workerA.db
			.select()
			.from(donations)
			.where(eq(donations.id, donationId))
			.limit(1);

		expect(donation).toBeDefined();
		expect(donation.type).toBe('recurring');
		expect(donation.subscriptionCreationStatus).toBe('activated');
		expect(donation.mollieSubscriptionId).toBe(subscriptionId);

		const [donor] = await workerA.db
			.select()
			.from(donors)
			.where(eq(donors.id, fixture.donorId))
			.limit(1);

		expect(donor?.mollieCustomerId).toBe(customerId);

		const enteredMollie = deferred<void>();
		const releaseMollie = deferred<void>();

		// Simuler le passage de pending à active.
		const snapshot: MollieSubscriptionSnapshot = {
			id: subscriptionId,
			status: 'active',
			metadata: {
				donationId
			}
		};

		const getSubscriptionA = vi.fn(async () => {
			enteredMollie.resolve();

			// Maintenir le premier worker dans l'appel Mollie.
			await releaseMollie.promise;

			return snapshot;
		});

		const getSubscriptionB = vi.fn(async () => snapshot);

		const syncA = createSubscriptionSynchronizer(workerA.db, getSubscriptionA, withLockA);

		const syncB = createSubscriptionSynchronizer(workerB.db, getSubscriptionB, withLockB);

		// Premier worker : acquisition du verrou et appel Mollie.
		const firstExecution = syncA(subscriptionId);

		try {
			// Attendre que le premier worker ait atteint Mollie.
			await enteredMollie.promise;

			// Deuxième worker : tentative concurrente.
			const secondResult = await syncB(subscriptionId);

			expect(secondResult).toBe('already_running');

			// Le deuxième worker ne doit pas appeler Mollie.
			expect(getSubscriptionB).not.toHaveBeenCalled();
		} finally {
			// Toujours débloquer le premier worker.
			releaseMollie.resolve();
		}

		const firstResult = await firstExecution;

		expect(firstResult).toBe('updated');
		expect(getSubscriptionA).toHaveBeenCalledTimes(1);

		// Vérifier la mise à jour effective en base.
		const [updatedDonation] = await workerA.db
			.select({
				status: donations.mollieSubscriptionStatus,
				syncedAt: donations.mollieSubscriptionSyncedAt
			})
			.from(donations)
			.where(eq(donations.id, donationId))
			.limit(1);

		expect(updatedDonation.status).toBe('active');
		expect(updatedDonation.syncedAt).toBeInstanceOf(Date);

		// Le premier traitement est terminé : le verrou est libéré.
		const thirdResult = await syncB(subscriptionId);

		expect(thirdResult).toBe('unchanged');
		expect(getSubscriptionB).toHaveBeenCalledTimes(1);
	}, 30_000);

	it('releases the lock when Mollie request fails', async () => {
		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		await resetSubscriptionStatus();

		const mollieError = new Error('Mollie API unavailable');

		const failingGetSubscription = vi.fn(async () => {
			throw mollieError;
		});

		const successfulGetSubscription = vi.fn(async (): Promise<MollieSubscriptionSnapshot> => ({
			id: subscriptionId,
			status: 'active',
			metadata: { donationId }
		}));

		const syncA = createSubscriptionSynchronizer(workerA.db, failingGetSubscription, withLockA);

		const syncB = createSubscriptionSynchronizer(workerB.db, successfulGetSubscription, withLockB);

		// Le premier worker échoue pendant l'appel Mollie.
		await expect(syncA(subscriptionId)).rejects.toThrow('Mollie API unavailable');

		expect(failingGetSubscription).toHaveBeenCalledTimes(1);

		// Le verrou doit avoir été libéré malgré l'exception.
		const result = await syncB(subscriptionId);

		expect(result).toBe('updated');
		expect(successfulGetSubscription).toHaveBeenCalledTimes(1);

		const [donation] = await workerB.db
			.select({
				status: donations.mollieSubscriptionStatus,
				syncedAt: donations.mollieSubscriptionSyncedAt
			})
			.from(donations)
			.where(eq(donations.id, donationId))
			.limit(1);

		expect(donation.status).toBe('active');
		expect(donation.syncedAt).toBeInstanceOf(Date);
	}, 30_000);

	it('releases the lock when database transaction fails', async () => {
		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		await resetSubscriptionStatus();

		const snapshot: MollieSubscriptionSnapshot = {
			id: subscriptionId,
			status: 'active',
			metadata: { donationId }
		};

		const getSubscriptionA = vi.fn(async () => snapshot);
		const getSubscriptionB = vi.fn(async () => snapshot);

		// Simuler une erreur au démarrage de la transaction.

		const transactionError = new Error('Simulated PostgreSQL transaction failure');

		const transactionSpy = vi.spyOn(workerA.db, 'transaction').mockRejectedValue(transactionError);

		const syncA = createSubscriptionSynchronizer(workerA.db, getSubscriptionA, withLockA);

		const syncB = createSubscriptionSynchronizer(workerB.db, getSubscriptionB, withLockB);

		try {
			await expect(syncA(subscriptionId)).rejects.toThrow(
				'Simulated PostgreSQL transaction failure'
			);

			expect(getSubscriptionA).toHaveBeenCalledTimes(1);
		} finally {
			// Restaurer immédiatement la méthode Drizzle originale.
			transactionSpy.mockRestore();
		}

		// Vérifier que le second worker peut reprendre le traitement.
		// Une nouvelle synchronisation doit pouvoir acquérir le verrou.
		const result = await syncB(subscriptionId);

		expect(result).toBe('updated');
		expect(getSubscriptionB).toHaveBeenCalledTimes(1);

		const [donation] = await workerB.db
			.select({
				status: donations.mollieSubscriptionStatus,
				syncedAt: donations.mollieSubscriptionSyncedAt
			})
			.from(donations)
			.where(eq(donations.id, donationId))
			.limit(1);

		expect(donation.status).toBe('active');
		expect(donation.syncedAt).toBeInstanceOf(Date);
	}, 30_000);

	it('rejects an obsolete synchronization using the fencing generation', async () => {
		const { subscriptionId, donationId } = fixture;

		if (!subscriptionId) {
			throw new Error('Missing subscription ID');
		}

		await resetSubscriptionStatus();

		const enteredMollie = deferred<void>();
		const releaseMollie = deferred<void>();

		// Ce verrou factice permet de tester une situation
		// qui surviendrait si le verrou PostgreSQL était perdu.
		const withoutLock = async <T>(_subscriptionId: string, handler: () => Promise<T>) => ({
			acquired: true as const,
			result: await handler()
		});

		const getSubscriptionA = vi.fn(async (): Promise<MollieSubscriptionSnapshot> => {
			enteredMollie.resolve();

			// Le premier worker attend avant de retourner
			// une réponse Mollie devenue obsolète.
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

		const syncA = createSubscriptionSynchronizer(workerA.db, getSubscriptionA, withoutLock);

		const syncB = createSubscriptionSynchronizer(workerB.db, getSubscriptionB, withoutLock);

		const firstExecution = syncA(subscriptionId);

		try {
			// A a déjà réservé sa génération et attend Mollie.
			await enteredMollie.promise;

			// B réserve une génération supérieure et écrit
			// son résultat avant la fin de A.
			const secondResult = await syncB(subscriptionId);

			expect(secondResult).toBe('updated');

			const [afterB] = await workerB.db
				.select({
					status: donations.mollieSubscriptionStatus
				})
				.from(donations)
				.where(eq(donations.id, donationId))
				.limit(1);

			expect(afterB.status).toBe('active');
		} finally {
			// Toujours débloquer A, même en cas d'échec.
			releaseMollie.resolve();
		}

		const firstResult = await firstExecution;

		// A ne doit pas pouvoir enregistrer sa réponse obsolète.
		expect(firstResult).toBe('superseded');

		const [finalDonation] = await workerA.db
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

		expect(getSubscriptionA).toHaveBeenCalledTimes(1);
		expect(getSubscriptionB).toHaveBeenCalledTimes(1);
	}, 30_000);
});
