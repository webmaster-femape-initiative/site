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
};

export async function createMollieSubscription(data: CreateMollieSubscriptionData) {
	const webhookUrl = getMollieWebhookUrl();

	const interval = data.frequency === 'monthly' ? '1 month' : '3 months';

	/*
	 * Le premier paiement a déjà été encaissé avec
	 * sequenceType="first".
	 *
	 * paymentCount représente le nombre TOTAL de versements
	 * souhaités par le donateur.
	 *
	 * La subscription Mollie ne doit donc générer que les
	 * paiements restants.
	 */
	const remainingPayments = data.paymentCount != null ? data.paymentCount - 1 : null;

	if (remainingPayments != null && remainingPayments < 1) {
		throw new Error('Recurring donation must have at least one remaining payment');
	}

	return mollie.subscriptions.create({
		customerId: data.customerId,

		/*
		 * L'UUID de la donation identifie de façon stable
		 * cette subscription.
		 */
		idempotencyKey: data.donationId,

		subscriptionRequest: {
			amount: {
				currency: 'EUR',

				value: formatMollieAmount(data.amount)
			},

			interval,

			description: `Don récurrent FEMAPE ${data.donationId}`,

			webhookUrl,

			/*
			 * Pour un don à durée déterminée, le premier
			 * versement ayant déjà été encaissé, Mollie
			 * ne doit générer que les versements restants.
			 */
			...(remainingPayments != null
				? {
						times: remainingPayments
					}
				: {}),

			/*
			 * Utilisation explicite du mandat créé par
			 * le premier paiement lorsqu'il est disponible.
			 */
			...(data.mandateId
				? {
						mandateId: data.mandateId
					}
				: {})
		}
	});
}
