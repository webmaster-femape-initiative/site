import { and, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { donations, donors } from '$lib/server/db/schema';

import { getMollieSubscription } from '$lib/server/mollie/subscriptions';

export type MollieSubscriptionStatus =
	'pending' | 'active' | 'suspended' | 'canceled' | 'completed';

export type SubscriptionSyncResult =
	'updated' | 'unchanged' | 'terminal' | 'suspended' | 'not_found';

export async function syncSubscriptionStatus(
	mollieSubscriptionId: string,
	mollieStatus: MollieSubscriptionStatus
): Promise<SubscriptionSyncResult> {
	if (!mollieSubscriptionId.trim()) {
		throw new Error('Mollie subscription ID is required');
	}

	const [donation] = await db
		.select({
			id: donations.id,
			status: donations.status,
			mollieSubscriptionStatus: donations.mollieSubscriptionStatus
		})
		.from(donations)
		.where(
			and(
				eq(donations.type, 'recurring'),
				eq(donations.subscriptionCreationStatus, 'activated'),
				eq(donations.mollieSubscriptionId, mollieSubscriptionId)
			)
		)
		.limit(1);

	if (!donation) {
		return 'not_found';
	}

	const now = new Date();

	const isTerminal =
		donation.status === 'cancelled' ||
		donation.status === 'completed' ||
		donation.status === 'failed';

	let targetStatus: typeof donation.status = donation.status;

	if (!isTerminal) {
		switch (mollieStatus) {
			case 'active':
				targetStatus = 'active';
				break;

			case 'canceled':
				targetStatus = 'cancelled';
				break;

			case 'completed':
				targetStatus = 'completed';
				break;

			case 'pending':
			case 'suspended':
				// Ne pas faire régresser un don actif.
				break;
		}
	}

	const [updated] = await db
		.update(donations)
		.set({
			mollieSubscriptionStatus: mollieStatus,
			mollieSubscriptionSyncedAt: now,
			status: targetStatus,
			updatedAt: now,
			...(targetStatus === 'cancelled' && !isTerminal ? { cancelledAt: now } : {}),
			...(targetStatus === 'completed' && !isTerminal ? { completedAt: now } : {})
		})
		.where(
			and(
				eq(donations.id, donation.id),
				eq(donations.type, 'recurring'),
				eq(donations.subscriptionCreationStatus, 'activated'),
				eq(donations.mollieSubscriptionId, mollieSubscriptionId),
				eq(donations.status, donation.status)
			)
		)
		.returning({
			id: donations.id
		});

	if (!updated) {
		// Une autre opération a modifié le don entre
		// la lecture et la mise à jour.
		return 'unchanged';
	}

	if (isTerminal) {
		return 'terminal';
	}

	if (mollieStatus === 'suspended') {
		return 'suspended';
	}

	return targetStatus !== donation.status || donation.mollieSubscriptionStatus !== mollieStatus
		? 'updated'
		: 'unchanged';
}

/**
 * Synchronise un don récurrent à partir de l'état
 * actuel de son abonnement chez Mollie.
 */
function isSupportedSubscriptionStatus(status: string): status is MollieSubscriptionStatus {
	return (
		status === 'pending' ||
		status === 'active' ||
		status === 'suspended' ||
		status === 'canceled' ||
		status === 'completed'
	);
}

export async function syncMollieSubscription(
	mollieSubscriptionId: string
): Promise<SubscriptionSyncResult> {
	if (!mollieSubscriptionId.trim()) {
		throw new Error('Mollie subscription ID is required');
	}

	return db.transaction(async (tx) => {
		const [donation] = await tx
			.select()
			.from(donations)
			.where(
				and(
					eq(donations.type, 'recurring'),
					eq(donations.subscriptionCreationStatus, 'activated'),
					eq(donations.mollieSubscriptionId, mollieSubscriptionId)
				)
			)
			.for('update')
			.limit(1);

		if (!donation) {
			return 'not_found';
		}

		const [donor] = await tx
			.select({
				mollieCustomerId: donors.mollieCustomerId
			})
			.from(donors)
			.where(eq(donors.id, donation.donorId))
			.limit(1);

		if (!donor?.mollieCustomerId) {
			throw new Error(`Mollie customer ID is missing for donation ${donation.id}`);
		}

		const subscription = await getMollieSubscription({
			customerId: donor.mollieCustomerId,
			subscriptionId: mollieSubscriptionId
		});

		if (subscription.id !== mollieSubscriptionId) {
			throw new Error('Mollie subscription ID mismatch');
		}

		const metadata = subscription.metadata;

		if (
			metadata !== null &&
			typeof metadata === 'object' &&
			!Array.isArray(metadata) &&
			'donationId' in metadata &&
			metadata.donationId !== donation.id
		) {
			throw new Error(`Mollie subscription ${subscription.id} belongs to another donation`);
		}

		const mollieStatus = String(subscription.status);

		if (!isSupportedSubscriptionStatus(mollieStatus)) {
			throw new Error(`Unsupported Mollie subscription status: ${mollieStatus}`);
		}

		const now = new Date();

		const isTerminal =
			donation.status === 'cancelled' ||
			donation.status === 'completed' ||
			donation.status === 'failed';

		let targetStatus = donation.status;

		if (!isTerminal) {
			switch (mollieStatus) {
				case 'active':
					targetStatus = 'active';
					break;

				case 'canceled':
					targetStatus = 'cancelled';
					break;

				case 'completed':
					targetStatus = 'completed';
					break;

				case 'pending':
				case 'suspended':
					break;
			}
		}

		const statusChanged = targetStatus !== donation.status;

		const technicalStatusChanged = mollieStatus !== donation.mollieSubscriptionStatus;

		await tx
			.update(donations)
			.set({
				status: targetStatus,

				mollieSubscriptionStatus: mollieStatus,
				mollieSubscriptionSyncedAt: now,

				updatedAt: now,

				...(statusChanged && targetStatus === 'cancelled' ? { cancelledAt: now } : {}),

				...(statusChanged && targetStatus === 'completed' ? { completedAt: now } : {})
			})
			.where(eq(donations.id, donation.id));

		if (isTerminal) {
			return 'terminal';
		}

		if (mollieStatus === 'suspended') {
			return 'suspended';
		}

		return statusChanged || technicalStatusChanged ? 'updated' : 'unchanged';
	});
}
