import { and, eq } from 'drizzle-orm';

import { db, client } from '$lib/server/db';

import { donations } from '$lib/server/db/schema';

import { getMollieSubscription } from '$lib/server/mollie/subscriptions';

export type MollieSubscriptionStatus =
	'pending' | 'active' | 'suspended' | 'canceled' | 'completed';

export type SubscriptionSyncResult =
	'updated' | 'unchanged' | 'terminal' | 'suspended' | 'not_found';

import { createSubscriptionSynchronizer } from './subscription-sync-core';
import { createSubscriptionLock } from './subscription-sync-lock';

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

const withSubscriptionLock = createSubscriptionLock(client);

export const syncMollieSubscription = createSubscriptionSynchronizer(
	db,
	getMollieSubscription,
	withSubscriptionLock
);
