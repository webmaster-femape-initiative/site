import { db } from '$lib/server/db';
import { donationPayments, donations, donors } from '$lib/server/db/schema';

import type {
	DonationDuration,
	DonationFrequency,
	DonationPaymentMethod,
	DonationType
} from './types';

export type CreateDonationRequestData = {
	firstName: string;
	lastName: string;
	email: string;
	address: string;
	postalCode: string;
	city: string;
	country: string;

	type: DonationType;
	amount: number;
	paymentMethod: DonationPaymentMethod;

	frequency?: DonationFrequency | null;
	duration?: DonationDuration | null;
	paymentCount?: number | null;
};

export async function createDonationRequest(input: CreateDonationRequestData) {
	return db.transaction(async (tx) => {
		/* ========================================================
		 * NORMALISATION DU DONATEUR
		 * ========================================================
		 */

		const donorData = {
			firstName: input.firstName.trim(),
			lastName: input.lastName.trim(),
			email: input.email.trim().toLowerCase(),
			address: input.address.trim(),
			postalCode: input.postalCode.trim(),
			city: input.city.trim(),
			country: input.country.trim().toUpperCase()
		};

		/* ========================================================
		 * DONATEUR
		 * ========================================================
		 */

		const [donor] = await tx.insert(donors).values(donorData).returning();

		if (!donor) {
			throw new Error('Unable to create donor');
		}

		/* ========================================================
		 * DON / ENGAGEMENT
		 * ========================================================
		 */

		const [donation] = await tx
			.insert(donations)
			.values({
				donorId: donor.id,

				type: input.type,
				amount: input.amount,
				paymentMethod: input.paymentMethod,

				frequency: input.type === 'recurring' ? input.frequency : null,

				duration: input.type === 'recurring' ? input.duration : null,

				paymentCount:
					input.type === 'recurring' && input.duration === 'fixed' ? input.paymentCount : null,

				status: 'pending',

				/*
				 * Snapshot du donateur au moment
				 * de la souscription.
				 */
				donorFirstName: donor.firstName,
				donorLastName: donor.lastName,
				donorEmail: donor.email,
				donorAddress: donor.address,
				donorPostalCode: donor.postalCode,
				donorCity: donor.city,
				donorCountry: donor.country
			})
			.returning();

		if (!donation) {
			throw new Error('Unable to create donation');
		}

		/* ========================================================
		 * PREMIER PAIEMENT
		 * ========================================================
		 *
		 * Le snapshot est volontairement pris depuis la fiche
		 * donor courante.
		 *
		 * Pour les paiements récurrents suivants, nous referons
		 * exactement cela afin qu'un changement d'adresse du
		 * donateur soit pris en compte pour les futurs reçus.
		 */

		const [payment] = await tx
			.insert(donationPayments)
			.values({
				donationId: donation.id,

				sequenceNumber: 1,
				amount: donation.amount,
				status: 'pending',

				donorFirstName: donor.firstName,
				donorLastName: donor.lastName,
				donorEmail: donor.email,
				donorAddress: donor.address,
				donorPostalCode: donor.postalCode,
				donorCity: donor.city,
				donorCountry: donor.country
			})
			.returning();

		if (!payment) {
			throw new Error('Unable to create initial donation payment');
		}

		return {
			donor,
			donation,
			payment
		};
	});
}
