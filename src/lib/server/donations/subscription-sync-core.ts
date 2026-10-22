import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import { donations, donors } from '../db/schema.ts';

import { SubscriptionSyncValidationError } from './subscription-sync-errors.ts';

import type { SubscriptionLockResult } from './subscription-sync-lock.ts';

export type MollieSubscriptionStatus =
	'pending' | 'active' | 'suspended' | 'canceled' | 'completed';

export type SubscriptionSyncResult =
	| 'updated'
	| 'unchanged'
	| 'terminal'
	| 'suspended'
	| 'not_found'
	| 'already_running'
	| 'superseded';

export type MollieSubscriptionSnapshot = {
	id: string;
	status: string;
	metadata: unknown;
};

export type GetSubscription = (data: {
	customerId: string;
	subscriptionId: string;
}) => Promise<MollieSubscriptionSnapshot>;

export type WithSubscriptionLock = <T>(
	subscriptionId: string,
	handler: () => Promise<T>
) => Promise<SubscriptionLockResult<T>>;

function isSupportedSubscriptionStatus(status: string): status is MollieSubscriptionStatus {
	return ['pending', 'active', 'suspended', 'canceled', 'completed'].includes(status);
}

function getMetadataDonationId(metadata: unknown): string | null {
	if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
		return null;
	}

	const donationId = (metadata as Record<string, unknown>).donationId;

	return typeof donationId === 'string' ? donationId : null;
}

export function createSubscriptionSynchronizer(
	db: Database,
	getSubscription: GetSubscription,
	withSubscriptionLock: WithSubscriptionLock
) {
	return async function syncMollieSubscription(
		mollieSubscriptionId: string
	): Promise<SubscriptionSyncResult> {
		return (async () => {
			const locked = await withSubscriptionLock(
				mollieSubscriptionId,
				async (): Promise<SubscriptionSyncResult> => {
					// Lecture initiale : aucune transaction ouverte
					// pendant l'appel réseau à Mollie.
					const [initialDonation] = await db
						.select()
						.from(donations)
						.where(
							and(
								eq(donations.mollieSubscriptionId, mollieSubscriptionId),
								eq(donations.type, 'recurring'),
								eq(donations.subscriptionCreationStatus, 'activated')
							)
						)
						.limit(1);

					if (!initialDonation) {
						return 'not_found';
					}

					const [donor] = await db
						.select()
						.from(donors)
						.where(eq(donors.id, initialDonation.donorId))
						.limit(1);

					if (!donor?.mollieCustomerId) {
						throw new SubscriptionSyncValidationError(
							'invalid_metadata',
							`Missing Mollie customer ID for donation ${initialDonation.id}`
						);
					}

					const [reservation] = await db
						.update(donations)
						.set({
							mollieSubscriptionSyncGeneration: sql`
								${donations.mollieSubscriptionSyncGeneration} + 1
							`
						})
						.where(
							and(
								eq(donations.id, initialDonation.id),
								eq(donations.mollieSubscriptionId, mollieSubscriptionId),
								eq(donations.subscriptionCreationStatus, 'activated')
							)
						)
						.returning({
							generation: donations.mollieSubscriptionSyncGeneration
						});

					if (!reservation) {
						return 'not_found';
					}

					const reservedGeneration = reservation.generation;

					// L'appel HTTP est effectué hors transaction.
					const subscription = await getSubscription({
						customerId: donor.mollieCustomerId,
						subscriptionId: mollieSubscriptionId
					});

					if (subscription.id !== mollieSubscriptionId) {
						throw new SubscriptionSyncValidationError(
							'invalid_metadata',
							`Mollie subscription ID mismatch: expected ${mollieSubscriptionId}, received ${subscription.id}`
						);
					}

					const metadataDonationId = getMetadataDonationId(subscription.metadata);

					if (metadataDonationId !== initialDonation.id) {
						throw new SubscriptionSyncValidationError(
							'invalid_metadata',
							`Mollie subscription donationId mismatch for ${mollieSubscriptionId}`
						);
					}

					if (!isSupportedSubscriptionStatus(subscription.status)) {
						throw new SubscriptionSyncValidationError(
							'unsupported_status',
							`Unsupported Mollie subscription status: ${subscription.status}`
						);
					}

					const status = subscription.status;

					// Transaction courte : verrouillage et mise à jour.
					return db.transaction(async (tx) => {
						const [donation] = await tx
							.select()
							.from(donations)
							.where(
								and(
									eq(donations.mollieSubscriptionId, mollieSubscriptionId),
									eq(donations.type, 'recurring'),
									eq(donations.subscriptionCreationStatus, 'activated')
								)
							)
							.for('update')
							.limit(1);

						if (!donation) {
							return 'not_found';
						}

						// Vérification supplémentaire si la donation
						// a changé entre la lecture et l'écriture.
						if (donation.id !== initialDonation.id) {
							throw new SubscriptionSyncValidationError(
								'invalid_metadata',
								`Donation changed during subscription synchronization: ${mollieSubscriptionId}`
							);
						}

						if (donation.mollieSubscriptionSyncGeneration !== reservedGeneration) {
							return 'superseded';
						}

						const now = new Date();

						const isTerminal = status === 'canceled' || status === 'completed';

						const isSuspended = status === 'suspended';

						const isUnchanged = donation.mollieSubscriptionStatus === status;

						if (isUnchanged) {
							await tx
								.update(donations)
								.set({
									mollieSubscriptionSyncedAt: now,
									updatedAt: now
								})
								.where(eq(donations.id, donation.id));

							if (isTerminal) return 'terminal';
							if (isSuspended) return 'suspended';

							return 'unchanged';
						}

						await tx
							.update(donations)
							.set({
								mollieSubscriptionStatus: status,
								mollieSubscriptionSyncedAt: now,
								updatedAt: now,
								...(status === 'canceled' ? { canceledAt: now } : {}),
								...(status === 'completed' ? { completedAt: now } : {})
							})
							.where(eq(donations.id, donation.id));

						if (isTerminal) return 'terminal';
						if (isSuspended) return 'suspended';

						return 'updated';
					});
				}
			);

			if (!locked.acquired) {
				return 'already_running';
			}

			return locked.result;
		})();
	};
}
