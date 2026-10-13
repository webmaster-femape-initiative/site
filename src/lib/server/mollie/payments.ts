import { getMollieWebhookUrl } from '$lib/server/mollie/webhook-url';

import { formatMollieAmount } from '$lib/server/mollie/amount';
import { mollie } from '$lib/server/mollie/client';

import type { DonationRefundStatus } from '$lib/server/donations/refunds';

import type { MollieChargebackSnapshot } from '$lib/server/donations/chargebacks';

export type CreateMolliePaymentData = {
	donationId: string;
	paymentId: string;

	/**
	 * Montant en centimes.
	 */
	amount: number;

	type: 'one-off' | 'recurring';

	/**
	 * Obligatoire pour un don récurrent.
	 */
	customerId?: string;

	/**
	 * URL vers laquelle le navigateur du donateur
	 * sera redirigé après le checkout Mollie.
	 *
	 * Cette URL est construite par +page.server.ts
	 * afin de conserver la locale Paraglide.
	 *
	 * Exemple en développement :
	 * http://localhost:5173/fr/donations/confirmation
	 */
	redirectUrl: string;
};

/**
 * Crée le paiement initial Mollie associé
 * à un donation_payment local.
 */
export async function createMolliePayment(data: CreateMolliePaymentData) {
	if (data.type === 'recurring' && !data.customerId) {
		throw new Error('A Mollie customer is required for a recurring donation');
	}

	/*
	 * La redirectUrl est fournie par la couche HTTP
	 * SvelteKit car elle dépend de la locale Paraglide.
	 */
	let redirectUrl: URL;

	try {
		redirectUrl = new URL(data.redirectUrl);
	} catch {
		throw new Error('redirectUrl is not a valid URL');
	}

	if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
		throw new Error('redirectUrl must use HTTP or HTTPS');
	}

	const webhookUrl = getMollieWebhookUrl();

	return mollie.payments.create({
		/*
		 * L'UUID PostgreSQL du donation_payment
		 * sert de clé d'idempotence.
		 *
		 * Une nouvelle tentative pour le même paiement
		 * ne doit pas créer un second paiement Mollie.
		 */
		idempotencyKey: data.paymentId,

		paymentRequest: {
			amount: {
				currency: 'EUR',

				value: formatMollieAmount(data.amount)
			},

			description: 'Don à FEMAPE Initiative',

			/*
			 * Retour du navigateur.
			 *
			 * Peut être localhost en développement.
			 *
			 * Exemples :
			 *
			 * http://localhost:5173/fr/donations/confirmation
			 * http://localhost:5173/en/donations/confirmation
			 */
			redirectUrl: redirectUrl.toString(),

			/*
			 * Appel effectué directement par
			 * les serveurs Mollie.
			 *
			 * Cette URL doit donc être publiquement
			 * accessible.
			 */
			webhookUrl,

			/*
			 * Le premier paiement d'un don récurrent
			 * permet notamment d'établir le mandat.
			 */
			sequenceType: data.type === 'recurring' ? 'first' : 'oneoff',

			/*
			 * Le customerId n'est envoyé que
			 * pour les dons récurrents.
			 */
			...(data.customerId
				? {
						customerId: data.customerId
					}
				: {}),

			/*
			 * Ces identifiants permettent de rapprocher
			 * le paiement Mollie de nos données locales.
			 */
			metadata: {
				donationId: data.donationId,

				paymentId: data.paymentId
			}
		}
	});
}

/**
 * Récupère l'état courant d'un paiement
 * directement auprès de Mollie.
 *
 * Le webhook utilise notamment cette fonction
 * afin de ne jamais faire confiance uniquement
 * aux données reçues dans la requête HTTP.
 */
export async function getMolliePayment(molliePaymentId: string) {
	return mollie.payments.get({
		paymentId: molliePaymentId
	});
}

import type { MollieRefundSnapshot } from '$lib/server/donations/refunds';

function refundAmountToCents(value: string): number {
	if (!/^\d+\.\d{2}$/.test(value)) {
		throw new Error(`Invalid Mollie refund amount: ${value}`);
	}

	const [euros, cents] = value.split('.');
	const amount = Number(euros) * 100 + Number(cents);

	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new Error(`Invalid Mollie refund amount: ${value}`);
	}

	return amount;
}

function parseRefundDate(value: string | null | undefined): Date | null {
	if (!value) return null;

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid Mollie refund date: ${value}`);
	}

	return date;
}

function isDonationRefundStatus(status: string): status is DonationRefundStatus {
	return (
		status === 'queued' ||
		status === 'pending' ||
		status === 'processing' ||
		status === 'refunded' ||
		status === 'failed' ||
		status === 'canceled'
	);
}

/**
 * Récupère l'intégralité des remboursements Mollie d'un paiement.
 *
 * Ne retourne jamais volontairement une liste partielle :
 * une erreur de pagination doit interrompre le traitement.
 */
export async function getMolliePaymentRefunds(
	molliePaymentId: string
): Promise<MollieRefundSnapshot[]> {
	if (!molliePaymentId) {
		throw new Error('Mollie payment ID is required.');
	}

	const result = await mollie.refunds.list({
		paymentId: molliePaymentId,
		limit: 250
	});

	const refunds: MollieRefundSnapshot[] = [];
	const seenIds = new Set<string>();

	for await (const page of result) {
		const items = page.result.embedded.refunds;

		for (const refund of items) {
			if (seenIds.has(refund.id)) {
				throw new Error(`Duplicate Mollie refund: ${refund.id}`);
			}

			seenIds.add(refund.id);

			if (refund.amount.currency !== 'EUR') {
				throw new Error(`Unexpected refund currency for ${refund.id}`);
			}

			const status = String(refund.status);

			if (!isDonationRefundStatus(status)) {
				throw new Error(`Unsupported Mollie refund status: ${status}`);
			}

			refunds.push({
				id: refund.id,
				amount: refundAmountToCents(refund.amount.value),
				status,
				mollieCreatedAt: parseRefundDate(refund.createdAt),
				refundedAt: null
			});
		}
	}

	return refunds;
}

function chargebackAmountToCents(value: string): number {
	if (!/^\d+\.\d{2}$/.test(value)) {
		throw new Error(`Invalid Mollie chargeback amount: ${value}`);
	}

	const [euros, cents] = value.split('.');
	const amount = Number(euros) * 100 + Number(cents);

	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new Error(`Invalid Mollie chargeback amount: ${value}`);
	}

	return amount;
}

function parseChargebackDate(value: string | null | undefined): Date | null {
	if (!value) return null;

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid Mollie chargeback date: ${value}`);
	}

	return date;
}

/**
 * Récupère tous les chargebacks d'un paiement Mollie.
 *
 * La pagination est parcourue intégralement.
 */
export async function getMolliePaymentChargebacks(
	molliePaymentId: string
): Promise<MollieChargebackSnapshot[]> {
	if (!molliePaymentId) {
		throw new Error('Mollie payment ID is required.');
	}

	const result = await mollie.chargebacks.list({
		paymentId: molliePaymentId,
		limit: 250
	});

	const chargebacks: MollieChargebackSnapshot[] = [];
	const seenIds = new Set<string>();

	for await (const page of result) {
		const items = page.result.embedded.chargebacks;

		for (const chargeback of items) {
			if (seenIds.has(chargeback.id)) {
				throw new Error(`Duplicate Mollie chargeback: ${chargeback.id}`);
			}

			seenIds.add(chargeback.id);

			if (chargeback.amount.currency !== 'EUR') {
				throw new Error(`Unexpected chargeback currency for ${chargeback.id}`);
			}

			chargebacks.push({
				id: chargeback.id,
				amount: chargebackAmountToCents(chargeback.amount.value),
				status: chargeback.reversedAt ? 'reversed' : 'active',
				mollieCreatedAt: parseChargebackDate(chargeback.createdAt)
			});
		}
	}

	return chargebacks;
}
