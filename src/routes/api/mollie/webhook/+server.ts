import type { RequestHandler } from './$types';

import { getDonationByMollieSubscriptionId } from '$lib/server/donations/donations';

import {
	createRecurringDonationPayment,
	getDonationPaymentByMollieId,
	updateDonationPaymentStatus
} from '$lib/server/donations/payments';

import { syncDonationPaymentChargebacks } from '$lib/server/donations/chargebacks';
import { syncDonationPaymentRefunds } from '$lib/server/donations/refunds';

import { processPaidDonationPayment } from '$lib/server/donations/process-paid-payment';
import { reconcileDonationPaymentReceipt } from '$lib/server/donations/reconcile-receipts';
import { validateMollieFinancialState } from '$lib/server/donations/validate-mollie-financial-state';

import type { DonationPaymentStatus } from '$lib/server/donations/types';

import {
	getMolliePayment,
	getMolliePaymentRefunds,
	getMolliePaymentChargebacks
} from '$lib/server/mollie/payments';

import { syncMollieSubscription } from '$lib/server/donations/sync-subscription-status';

/* ==============================================================
 * STATUT MOLLIE -> STATUT MÉTIER
 * ============================================================== */

function toDonationPaymentStatus(status: string): DonationPaymentStatus | null {
	switch (status) {
		case 'open':
			return 'open';

		case 'pending':
			return 'pending';

		case 'authorized':
			return 'authorized';

		case 'paid':
		case 'refunded':
		case 'charged_back':
			// Un remboursement ou un chargeback ne remet pas
			// en cause l'encaissement initial.
			return 'paid';

		case 'failed':
			return 'failed';

		case 'canceled':
			return 'cancelled';

		case 'expired':
			return 'expired';

		default:
			return null;
	}
}

/* ==============================================================
 * MONTANT MOLLIE -> CENTIMES
 * ============================================================== */

function mollieAmountToCents(value: string): number | null {
	if (!/^\d+\.\d{2}$/.test(value)) {
		return null;
	}

	const [euros, cents] = value.split('.');
	const amount = Number(euros) * 100 + Number(cents);

	if (!Number.isSafeInteger(amount) || amount < 0) {
		return null;
	}

	return amount;
}

/* ==============================================================
 * MÉTHODE DE PAIEMENT MOLLIE
 * ============================================================== */

function getMolliePaymentMethod(method: unknown): string | null {
	if (typeof method !== 'string' || method.trim().length === 0) {
		return null;
	}

	return method.trim();
}

async function synchronizePaymentSubscription(
	subscriptionId: string | null | undefined
): Promise<boolean> {
	if (!subscriptionId) {
		return true;
	}

	try {
		const result = await syncMollieSubscription(subscriptionId);

		console.info('Mollie subscription synchronized:', {
			subscriptionId,
			result
		});

		return true;
	} catch (error) {
		console.error('Unable to synchronize Mollie subscription:', {
			subscriptionId,
			error
		});

		return false;
	}
}

/* ==============================================================
 * WEBHOOK MOLLIE
 * ============================================================== */

export const POST: RequestHandler = async ({ request }) => {
	// ==========================================================
	// 1. LIRE L'IDENTIFIANT DU PAIEMENT
	// ==========================================================

	let molliePaymentId: string;

	try {
		const formData = await request.formData();
		const id = formData.get('id');

		if (typeof id !== 'string' || !/^tr_[a-zA-Z0-9]+$/.test(id)) {
			console.warn('Invalid Mollie webhook payment ID');

			return new Response(null, { status: 400 });
		}

		molliePaymentId = id;
	} catch (error) {
		console.error('Unable to parse Mollie webhook:', error);
		return new Response(null, { status: 400 });
	}

	// ==========================================================
	// 2. RELIRE LE PAIEMENT CHEZ MOLLIE
	// ==========================================================

	let molliePayment: Awaited<ReturnType<typeof getMolliePayment>>;

	try {
		molliePayment = await getMolliePayment(molliePaymentId);

		console.log('Mollie payment state:', {
			id: molliePayment.id,
			status: molliePayment.status,
			amount: molliePayment.amount,
			amountRefunded: molliePayment.amountRefunded,
			amountChargedBack: molliePayment.amountChargedBack
		});
	} catch (error) {
		console.error('Unable to retrieve payment from Mollie:', molliePaymentId, error);

		return new Response(null, { status: 503 });
	}

	// ==========================================================
	// 3. VÉRIFIER L'IDENTIFIANT
	// ==========================================================

	if (molliePayment.id !== molliePaymentId) {
		console.error('Mollie payment ID mismatch', {
			expected: molliePaymentId,
			received: molliePayment.id
		});

		return new Response(null, { status: 500 });
	}

	// ==========================================================
	// 4. CONVERTIR LE STATUT ET LA MÉTHODE
	// ==========================================================

	const status = toDonationPaymentStatus(molliePayment.status);

	if (!status) {
		console.error('Unsupported Mollie payment status', {
			paymentId: molliePaymentId,
			status: molliePayment.status
		});

		return new Response(null, { status: 503 });
	}

	const molliePaymentMethod = getMolliePaymentMethod(molliePayment.method);

	// ==========================================================
	// 5. RECHERCHER LE PAIEMENT LOCAL
	// ==========================================================

	let localPayment: Awaited<ReturnType<typeof getDonationPaymentByMollieId>>;

	try {
		localPayment = await getDonationPaymentByMollieId(molliePaymentId);
	} catch (error) {
		console.error('Unable to retrieve local donation payment:', molliePaymentId, error);

		return new Response(null, { status: 503 });
	}

	// ==========================================================
	// 6. PAIEMENT INCONNU : ÉCHÉANCE RÉCURRENTE
	// ==========================================================

	if (!localPayment) {
		const subscriptionId = molliePayment.subscriptionId;

		if (!subscriptionId) {
			console.warn('Unknown Mollie payment without subscription', { paymentId: molliePaymentId });

			return new Response(null, { status: 200 });
		}

		let donation: Awaited<ReturnType<typeof getDonationByMollieSubscriptionId>>;

		try {
			donation = await getDonationByMollieSubscriptionId(subscriptionId);
		} catch (error) {
			console.error('Unable to retrieve donation by Mollie subscription:', subscriptionId, error);

			return new Response(null, { status: 503 });
		}

		if (!donation) {
			console.warn('Unknown Mollie subscription', {
				paymentId: molliePaymentId,
				subscriptionId
			});

			return new Response(null, { status: 200 });
		}

		// Vérifier les métadonnées si elles sont présentes.
		const metadata = molliePayment.metadata;

		if (metadata && typeof metadata === 'object' && 'donationId' in metadata) {
			if (typeof metadata.donationId !== 'string' || metadata.donationId !== donation.id) {
				console.error('Mollie payment donation metadata mismatch', {
					paymentId: molliePaymentId,
					subscriptionId,
					expectedDonationId: donation.id,
					receivedDonationId: metadata.donationId
				});

				return new Response(null, { status: 500 });
			}
		}

		// Vérifier la devise et le montant attendu.
		const amountInCents = mollieAmountToCents(molliePayment.amount.value);

		if (
			molliePayment.amount.currency !== 'EUR' ||
			amountInCents === null ||
			amountInCents !== donation.amount
		) {
			console.error('Mollie recurring payment amount mismatch', {
				paymentId: molliePaymentId,
				donationId: donation.id,
				expected: donation.amount,
				received: amountInCents,
				currency: molliePayment.amount.currency
			});

			return new Response(null, { status: 500 });
		}

		// Créer l'échéance locale de façon idempotente.
		try {
			localPayment = await createRecurringDonationPayment({
				donationId: donation.id,
				molliePaymentId,
				mollieCreatedAt: new Date(molliePayment.createdAt),
				molliePaymentMethod,
				amount: amountInCents,
				status,
				paidAt:
					status === 'paid'
						? molliePayment.paidAt
							? new Date(molliePayment.paidAt)
							: new Date()
						: null,
				failedAt: status === 'failed' ? new Date() : null
			});
		} catch (error) {
			console.error('Unable to create recurring donation payment:', {
				paymentId: molliePaymentId,
				donationId: donation.id,
				error
			});

			return new Response(null, { status: 503 });
		}
	}

	// ==========================================================
	// 7. METTRE À JOUR LE PAIEMENT LOCAL
	// ==========================================================

	// Un paiement déjà encaissé conserve son statut paid.
	const effectiveStatus: DonationPaymentStatus = localPayment.status === 'paid' ? 'paid' : status;

	const paymentNeedsUpdate =
		localPayment.status !== effectiveStatus ||
		(molliePaymentMethod !== null && localPayment.molliePaymentMethod !== molliePaymentMethod);

	if (paymentNeedsUpdate) {
		try {
			localPayment = await updateDonationPaymentStatus(localPayment.id, {
				status: effectiveStatus,
				molliePaymentMethod,
				paidAt:
					effectiveStatus === 'paid'
						? molliePayment.paidAt
							? new Date(molliePayment.paidAt)
							: (localPayment.paidAt ?? new Date())
						: undefined,
				failedAt: effectiveStatus === 'failed' ? (localPayment.failedAt ?? new Date()) : undefined
			});
		} catch (error) {
			console.error('Unable to update donation payment:', {
				paymentId: localPayment.id,
				molliePaymentId,
				status,
				molliePaymentMethod,
				error
			});

			return new Response(null, { status: 503 });
		}
	}

	// Aucun traitement financier ou fiscal pour les
	// paiements qui ne sont pas encore encaissés.
	if (effectiveStatus !== 'paid') {
		const synchronized = await synchronizePaymentSubscription(molliePayment.subscriptionId);

		return new Response(null, {
			status: synchronized ? 200 : 503
		});
	}

	// ==========================================================
	// 8. VALIDATION ET SYNCHRONISATION FINANCIÈRE
	// ==========================================================

	try {
		// Vérifier le montant initial.
		if (
			molliePayment.amount.currency !== 'EUR' ||
			mollieAmountToCents(molliePayment.amount.value) !== localPayment.amount
		) {
			throw new Error(`Mollie payment amount mismatch for ${molliePaymentId}`);
		}

		// Récupérer les opérations financières.
		const mollieChargebacks = await getMolliePaymentChargebacks(molliePaymentId);

		const mollieRefunds = await getMolliePaymentRefunds(molliePaymentId);

		// Contrôler la cohérence avant les écritures locales.
		validateMollieFinancialState({
			paymentId: localPayment.id,
			originalAmount: localPayment.amount,
			amountRefunded: molliePayment.amountRefunded,
			amountChargedBack: molliePayment.amountChargedBack,
			refunds: mollieRefunds,
			chargebacks: mollieChargebacks
		});

		// Synchroniser les chargebacks.
		await syncDonationPaymentChargebacks({
			paymentId: localPayment.id,
			molliePaymentId,
			chargebacks: mollieChargebacks
		});

		// Synchroniser les remboursements.
		await syncDonationPaymentRefunds({
			paymentId: localPayment.id,
			molliePaymentId,
			refunds: mollieRefunds
		});
	} catch (error) {
		console.error('Unable to validate or synchronize Mollie financial operations:', {
			paymentId: localPayment.id,
			molliePaymentId,
			error
		});

		return new Response(null, { status: 503 });
	}

	// ==========================================================
	// 9. TRAITEMENT MÉTIER DU PAIEMENT ENCAISSÉ
	// ==========================================================

	// Cette fonction doit rester idempotente.
	// Elle ne crée plus directement de reçu fiscal.
	if (!localPayment.molliePaymentMethod) {
		console.error('Paid Mollie payment has no payment method', {
			paymentId: localPayment.id,
			molliePaymentId
		});

		return new Response(null, { status: 503 });
	}

	try {
		await processPaidDonationPayment(localPayment.donationId, localPayment.sequenceNumber);
	} catch (error) {
		console.error('Unable to process paid donation payment:', {
			paymentId: localPayment.id,
			molliePaymentId,
			donationId: localPayment.donationId,
			sequenceNumber: localPayment.sequenceNumber,
			error
		});

		return new Response(null, { status: 503 });
	}

	// ==========================================================
	// 10. RÉCONCILIATION FISCALE
	// ==========================================================

	try {
		const reconciliation = await reconcileDonationPaymentReceipt(localPayment.id);

		if (reconciliation.action === 'manual_review_required') {
			console.warn('Donation receipt requires manual fiscal review', {
				paymentId: localPayment.id,
				molliePaymentId,
				netAmount: reconciliation.netAmount,
				receiptId: reconciliation.receiptId
			});
		}
	} catch (error) {
		console.error('Unable to reconcile donation receipt:', {
			paymentId: localPayment.id,
			molliePaymentId,
			error
		});

		return new Response(null, { status: 503 });
	}

	// ==========================================================
	// 11. WEBHOOK TRAITÉ
	// ==========================================================

	const synchronized = await synchronizePaymentSubscription(molliePayment.subscriptionId);

	return new Response(null, {
		status: synchronized ? 200 : 503
	});
};
