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

			metadata: {
				donationId: data.donationId
			},

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

export type FindExistingMollieSubscriptionData = {
	customerId: string;
	donationId: string;
};

type ListResult = Awaited<ReturnType<typeof mollie.subscriptions.list>>;

type Page = ListResult extends AsyncIterable<infer T> ? T : never;

type Subscription = NonNullable<Page['result']['embedded']['subscriptions']>[number];

export async function findExistingMollieSubscription(
	data: FindExistingMollieSubscriptionData
): Promise<Subscription | null> {
	const result = await mollie.subscriptions.list({
		customerId: data.customerId,
		limit: 250
	});

	const matches: Subscription[] = [];

	const expectedDescription = `Don récurrent FEMAPE ${data.donationId}`;

	for await (const page of result) {
		for (const subscription of page.result.embedded.subscriptions ?? []) {
			const metadata = subscription.metadata;

			const metadataDonationId =
				metadata !== null &&
				typeof metadata === 'object' &&
				!Array.isArray(metadata) &&
				'donationId' in metadata
					? metadata.donationId
					: undefined;

			const isMatch =
				metadataDonationId === data.donationId ||
				(metadataDonationId === undefined && subscription.description === expectedDescription);

			if (isMatch) {
				matches.push(subscription);
			}
		}
	}
	if (matches.length > 1) {
		throw new Error(`Multiple Mollie subscriptions found for donation ${data.donationId}`);
	}

	return matches[0] ?? null;
}

/**
 * Récupère un abonnement Mollie à partir de son identifiant
 * et de l'identifiant du client auquel il appartient.
 */

export type GetMollieSubscriptionData = {
	customerId: string;
	subscriptionId: string;
};

export async function getMollieSubscription(data: GetMollieSubscriptionData) {
	if (!data.customerId.trim()) {
		throw new Error('Mollie customer ID is required');
	}

	if (!data.subscriptionId.trim()) {
		throw new Error('Mollie subscription ID is required');
	}

	return mollie.subscriptions.get({
		customerId: data.customerId,
		subscriptionId: data.subscriptionId
	});
}
