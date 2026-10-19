import {
	completeOneOffDonation,
	completeRecurringDonation,
	getDonationById
} from '$lib/server/donations/donations';

import { getDonorById } from '$lib/server/donations/donors';

import {
	countPaidDonationPayments,
	getFirstPaidDonationPayment
} from '$lib/server/donations/payments';

import { getUsableMollieCustomerMandate } from '$lib/server/mollie/customers';

import {
	createMollieSubscription,
	findExistingMollieSubscription
} from '$lib/server/mollie/subscriptions';

import {
	reserveSubscriptionCreation,
	markSubscriptionReconciliationRequired,
	activateReservedSubscription,
	recoverExistingSubscription
} from '$lib/server/donations/subscription-reservation';

type RecoverableSubscription = NonNullable<
	Awaited<ReturnType<typeof findExistingMollieSubscription>>
> & {
	status: 'active' | 'pending';
};

function assertRecoverableSubscription(
	subscription: NonNullable<Awaited<ReturnType<typeof findExistingMollieSubscription>>>,
	customerId: string
): asserts subscription is RecoverableSubscription {
	if (subscription.customerId !== customerId) {
		throw new Error(`Mollie subscription ${subscription.id} belongs to another customer`);
	}

	if (subscription.status !== 'active' && subscription.status !== 'pending') {
		throw new Error(
			`Mollie subscription ${subscription.id} has status ` +
				`${subscription.status}; automatic recovery is not allowed`
		);
	}
}

type RegistrableSubscriptionStatus = 'active' | 'pending';

function assertRegistrableStatus(status: string): asserts status is RegistrableSubscriptionStatus {
	if (status !== 'active' && status !== 'pending') {
		throw new Error(`Mollie subscription status ${status} is not registrable`);
	}
}

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
	// 3 bis. Récupérer la date du premier paiement
	// ==========================================================

	const firstPayment = await getFirstPaidDonationPayment(donation.id);

	if (!firstPayment?.paidAt) {
		throw new Error(`First paid payment or payment date not found for donation ${donation.id}`);
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

	const customerId = donor.mollieCustomerId;

	// 1. Récupération d'une tentative précédente
	if (donation.subscriptionCreationStatus === 'reconciliation_required') {
		const existing = await findExistingMollieSubscription({
			customerId,
			donationId: donation.id
		});

		if (!existing) {
			throw new Error(
				`Subscription reconciliation required for donation ` +
					`${donation.id}: no Mollie subscription found`
			);
		}

		assertRecoverableSubscription(existing, customerId);

		const recovered = await recoverExistingSubscription(donation.id, existing.id, existing.status);

		if (!recovered) {
			throw new Error(`Unable to recover Mollie subscription for donation ${donation.id}`);
		}

		return;
	}

	// 2. Une réservation existe déjà : ne rien créer.
	if (donation.subscriptionCreationStatus === 'reserved') {
		return;
	}

	// 3. L'abonnement est déjà enregistré.
	if (donation.subscriptionCreationStatus === 'activated') {
		return;
	}

	// 4. Obtenir la réservation avant tout appel à Mollie.
	const reservation = await reserveSubscriptionCreation(donation.id);

	if (!reservation) {
		// Un autre traitement a pu réserver ou activer le don.
		// Ne jamais créer d'abonnement sans réservation.
		return;
	}

	try {
		// 5. Rechercher un abonnement déjà créé.
		const existing = await findExistingMollieSubscription({
			customerId,
			donationId: donation.id
		});

		if (existing) {
			assertRecoverableSubscription(existing, customerId);

			const activated = await activateReservedSubscription(
				reservation,
				existing.id,
				existing.status
			);

			if (!activated) {
				throw new Error(`Unable to activate existing subscription for donation ${donation.id}`);
			}

			return;
		}

		// 6. Création autorisée uniquement par le détenteur
		// de la réservation.
		const subscription = await createMollieSubscription({
			customerId,
			donationId: donation.id,
			amount: donation.amount,
			frequency: donation.frequency,
			paymentCount: donation.duration === 'fixed' ? donation.paymentCount : null,
			mandateId: mandate.id,
			firstPaymentDate: firstPayment.paidAt
		});

		// 7. Vérifier que l'abonnement peut être enregistré.
		// Un abonnement pending est enregistré sans activer le don.
		const subscriptionStatus = String(subscription.status);

		assertRegistrableStatus(subscriptionStatus);

		// 8. Enregistrement atomique avec vérification du jeton.
		const activated = await activateReservedSubscription(
			reservation,
			subscription.id,
			subscriptionStatus
		);

		if (!activated) {
			throw new Error(
				`Unable to register Mollie subscription ${subscription.id} ` + `for donation ${donation.id}`
			);
		}
	} catch (error) {
		// Une requête Mollie a pu réussir même si sa réponse
		// n'est pas parvenue au serveur.
		//
		// Ne jamais libérer la réservation vers 'idle' ici.
		try {
			const marked = await markSubscriptionReconciliationRequired(reservation);

			if (!marked) {
				// L'état a peut-être changé entre-temps.
				// La reprise devra consulter PostgreSQL.
			}
		} catch (markError) {
			console.error('Unable to mark subscription reconciliation', {
				donationId: donation.id,
				markError
			});
		}

		throw error;
	}
}
