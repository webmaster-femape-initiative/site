import {
	activateRecurringDonation,
	completeOneOffDonation,
	completeRecurringDonation,
	getDonationById
} from '$lib/server/donations/donations';

import { getDonorById } from '$lib/server/donations/donors';

import { countPaidDonationPayments } from '$lib/server/donations/payments';

import { getUsableMollieCustomerMandate } from '$lib/server/mollie/customers';

import { createMollieSubscription } from '$lib/server/mollie/subscriptions';

/**
 * Effectue les transitions métier après encaissement d'un paiement.
 *
 * La gestion des reçus fiscaux est exclusivement assurée
 * par reconcileDonationPaymentReceipt().
 *
 * Cette fonction doit pouvoir être rappelée lors des retries
 * du webhook Mollie.
 */
export async function processPaidDonationPayment(
	donationId: string,
	sequenceNumber: number
): Promise<void> {
	const donation = await getDonationById(donationId);

	if (!donation) {
		throw new Error(`Donation not found: ${donationId}`);
	}

	// ==========================================================
	// 1. Don ponctuel
	// ==========================================================

	if (donation.type === 'one-off') {
		if (sequenceNumber !== 1) {
			throw new Error(
				`Unexpected payment sequence ${sequenceNumber} ` + `for one-off donation ${donation.id}`
			);
		}

		// Un retry ne doit pas refaire une transition déjà effectuée.
		if (donation.status !== 'completed') {
			await completeOneOffDonation(donation.id);
		}

		return;
	}

	// ==========================================================
	// 2. Don récurrent : premier paiement
	// ==========================================================

	if (sequenceNumber === 1) {
		await processFirstRecurringPayment(donation);
		return;
	}

	// ==========================================================
	// 3. Don récurrent : paiements suivants
	// ==========================================================

	if (donation.duration === 'unlimited') {
		// Aucun changement d'état n'est nécessaire.
		return;
	}

	if (donation.duration !== 'fixed') {
		throw new Error(`Invalid duration for recurring donation ${donation.id}`);
	}

	if (donation.paymentCount == null || donation.paymentCount < 2) {
		throw new Error(`Invalid payment count for recurring donation ${donation.id}`);
	}

	// Compter les paiements réellement encaissés, indépendamment
	// de l'ordre de réception des webhooks.

	const paidPaymentCount = await countPaidDonationPayments(donation.id);

	if (paidPaymentCount >= donation.paymentCount) {
		if (donation.status !== 'completed') {
			await completeRecurringDonation(donation.id);
		}
	}
}

/**
 * Active un don récurrent après son premier paiement.
 *
 * Si une subscription Mollie est déjà enregistrée,
 * le traitement est considéré comme effectué.
 */
async function processFirstRecurringPayment(
	donation: NonNullable<Awaited<ReturnType<typeof getDonationById>>>
): Promise<void> {
	if (donation.mollieSubscriptionId) {
		return;
	}

	const donor = await getDonorById(donation.donorId);

	if (!donor) {
		throw new Error(`Donor not found: ${donation.donorId}`);
	}

	if (!donor.mollieCustomerId) {
		throw new Error(`Mollie customer ID is missing for donor ${donor.id}`);
	}

	if (!donation.frequency) {
		throw new Error(`Recurring donation frequency is missing for donation ${donation.id}`);
	}

	if (!donation.duration) {
		throw new Error(`Recurring donation duration is missing for donation ${donation.id}`);
	}

	if (
		donation.duration === 'fixed' &&
		(donation.paymentCount == null || donation.paymentCount < 2)
	) {
		throw new Error(`Invalid payment count for recurring donation ${donation.id}`);
	}

	// ==========================================================
	// 4. Vérifier le mandat Mollie
	// ==========================================================

	const mandate = await getUsableMollieCustomerMandate(donor.mollieCustomerId);

	if (!mandate) {
		throw new Error(`No usable Mollie mandate found for customer ${donor.mollieCustomerId}`);
	}

	// ==========================================================
	// 5. Créer et enregistrer la subscription Mollie
	// ==========================================================

	const subscription = await createMollieSubscription({
		customerId: donor.mollieCustomerId,
		donationId: donation.id,
		amount: donation.amount,
		frequency: donation.frequency,
		paymentCount: donation.duration === 'fixed' ? donation.paymentCount : null,
		mandateId: mandate.id
	});

	await activateRecurringDonation(donation.id, subscription.id);
}
