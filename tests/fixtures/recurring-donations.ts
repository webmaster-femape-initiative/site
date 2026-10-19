import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { donors, donations, donationPayments } from '$lib/server/db/schema';

export type RecurringDonationFixture = {
	donorId: string;
	donationId: string;
	paymentId: string;
	molliePaymentId: string;
	amount: number;
	cleanup: () => Promise<void>;
};

export async function createRecurringDonationFixture(): Promise<RecurringDonationFixture> {
	const amount = 2500;
	const suffix = crypto.randomUUID();

	const identity = {
		firstName: 'Test',
		lastName: 'Recurring',
		email: `recurring-${suffix}@example.test`,
		address: '1 rue du Test',
		postalCode: '75001',
		city: 'Paris',
		country: 'FR'
	};

	const molliePaymentId = `tr_test_${suffix}`;

	const [donor] = await db.insert(donors).values(identity).returning({ id: donors.id });

	let donationId: string | undefined;

	try {
		const [donation] = await db
			.insert(donations)
			.values({
				donorId: donor.id,
				type: 'recurring',
				amount,
				paymentMethod: 'card',
				frequency: 'monthly',
				duration: 'unlimited',
				status: 'active',

				donorFirstName: identity.firstName,
				donorLastName: identity.lastName,
				donorEmail: identity.email,
				donorAddress: identity.address,
				donorPostalCode: identity.postalCode,
				donorCity: identity.city,
				donorCountry: identity.country
			})
			.returning({ id: donations.id });

		donationId = donation.id;

		const [payment] = await db
			.insert(donationPayments)
			.values({
				donationId: donation.id,
				sequenceNumber: 1,
				amount,
				molliePaymentId,
				status: 'paid',
				paidAt: new Date(),
				molliePaymentMethod: 'creditcard',

				donorFirstName: identity.firstName,
				donorLastName: identity.lastName,
				donorEmail: identity.email,
				donorAddress: identity.address,
				donorPostalCode: identity.postalCode,
				donorCity: identity.city,
				donorCountry: identity.country
			})
			.returning({ id: donationPayments.id });

		return {
			donorId: donor.id,
			donationId: donation.id,
			paymentId: payment.id,
			molliePaymentId,
			amount,

			async cleanup() {
				await db.transaction(async (tx) => {
					// Supprime toutes les échéances créées
					// pendant les tests, y compris les nouvelles.
					await tx.delete(donationPayments).where(eq(donationPayments.donationId, donation.id));

					await tx.delete(donations).where(eq(donations.id, donation.id));

					await tx.delete(donors).where(eq(donors.id, donor.id));
				});
			}
		};
	} catch (error) {
		if (donationId) {
			await db.delete(donations).where(eq(donations.id, donationId));
		}

		await db.delete(donors).where(eq(donors.id, donor.id));

		throw error;
	}
}
