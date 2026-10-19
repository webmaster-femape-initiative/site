import { db } from '$lib/server/db';
import { donations } from '$lib/server/db/schema';

import { eq, and } from 'drizzle-orm';

import type { CreateDonationData } from './types';

export async function createDonation(data: CreateDonationData) {
	const [donation] = await db
		.insert(donations)
		.values({
			donorId: data.donorId,

			type: data.type,
			amount: data.amount,
			paymentMethod: data.paymentMethod,

			frequency: data.type === 'recurring' ? data.frequency : null,

			duration: data.type === 'recurring' ? data.duration : null,

			paymentCount:
				data.type === 'recurring' && data.duration === 'fixed' ? data.paymentCount : null,

			status: 'pending',

			donorFirstName: data.donor.firstName,
			donorLastName: data.donor.lastName,
			donorEmail: data.donor.email,
			donorAddress: data.donor.address,
			donorPostalCode: data.donor.postalCode,
			donorCity: data.donor.city,
			donorCountry: data.donor.country
		})
		.returning();

	if (!donation) {
		throw new Error('Unable to create donation');
	}

	return donation;
}

export async function getDonationById(donationId: string) {
	const [donation] = await db.select().from(donations).where(eq(donations.id, donationId)).limit(1);

	return donation ?? null;
}

export async function completeOneOffDonation(donationId: string) {
	const now = new Date();

	const [donation] = await db
		.update(donations)
		.set({
			status: 'completed',
			completedAt: now,
			updatedAt: now
		})
		.where(eq(donations.id, donationId))
		.returning();

	if (!donation) {
		throw new Error('Unable to complete one-off donation');
	}

	return donation;
}

export async function getDonationByMollieSubscriptionId(
	mollieSubscriptionId: string
): Promise<typeof donations.$inferSelect | null> {
	const [donation] = await db
		.select()
		.from(donations)
		.where(eq(donations.mollieSubscriptionId, mollieSubscriptionId))
		.limit(1);

	return donation ?? null;
}

export async function completeRecurringDonation(donationId: string) {
	const now = new Date();

	const [donation] = await db
		.update(donations)
		.set({
			status: 'completed',
			completedAt: now,
			updatedAt: now
		})
		.where(
			and(
				eq(donations.id, donationId),
				eq(donations.type, 'recurring'),
				eq(donations.status, 'active')
			)
		)
		.returning();

	if (!donation) {
		throw new Error(`Unable to complete recurring donation ${donationId}`);
	}

	return donation;
}
