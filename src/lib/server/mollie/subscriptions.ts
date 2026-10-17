import { formatMollieAmount } from '$lib/server/mollie/amount';
import { mollie } from '$lib/server/mollie/client';
import { getMollieWebhookUrl } from '$lib/server/mollie/webhook-url';

export type CreateMollieSubscriptionData = {
	customerId: string;
	donationId: string;
	amount: number;
	frequency: 'monthly' | 'quarterly';
	paymentCount?: number | null;
	mandateId?: string;

	/**
	 * Date du premier paiement effectivement encaissé.
	 */
	firstPaymentDate: Date;
};

/**
 * Ajoute un nombre de mois à une date UTC.
 *
 * Si le jour n'existe pas dans le mois cible,
 * utilise le dernier jour de ce mois.
 *
 * Exemple :
 * 31 janvier + 1 mois = 28 février
 * (ou 29 février pour une année bissextile).
 */
function addMonthsUTC(date: Date, months: number): Date {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	const day = date.getUTCDate();

	const target = new Date(Date.UTC(year, month + months, 1));

	const lastDay = new Date(
		Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
	).getUTCDate();

	target.setUTCDate(Math.min(day, lastDay));

	return target;
}

/**
 * Formate une date au format YYYY-MM-DD,
 * attendu par l'API Mollie.
 */
function formatMollieDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export async function createMollieSubscription(data: CreateMollieSubscriptionData) {
	const webhookUrl = getMollieWebhookUrl();

	const months = data.frequency === 'monthly' ? 1 : 3;

	const interval = data.frequency === 'monthly' ? '1 month' : '3 months';

	/*
	 * Le premier paiement a déjà été encaissé
	 * avec sequenceType="first".
	 *
	 * paymentCount représente le nombre TOTAL
	 * de versements souhaités par le donateur.
	 */
	const remainingPayments = data.paymentCount != null ? data.paymentCount - 1 : null;

	if (remainingPayments != null && remainingPayments < 1) {
		throw new Error('Recurring donation must have at least one remaining payment');
	}

	if (Number.isNaN(data.firstPaymentDate.getTime())) {
		throw new Error('Invalid first payment date');
	}

	/*
	 * La souscription commence à l'échéance suivante,
	 * et non à la date du premier paiement.
	 */
	const startDate = formatMollieDate(addMonthsUTC(data.firstPaymentDate, months));

	return mollie.subscriptions.create({
		customerId: data.customerId,

		idempotencyKey: data.donationId,

		subscriptionRequest: {
			amount: {
				currency: 'EUR',
				value: formatMollieAmount(data.amount)
			},

			interval,

			startDate,

			description: `Don récurrent FEMAPE ${data.donationId}`,

			webhookUrl,

			...(remainingPayments != null
				? {
						times: remainingPayments
					}
				: {}),

			...(data.mandateId
				? {
						mandateId: data.mandateId
					}
				: {})
		}
	});
}
