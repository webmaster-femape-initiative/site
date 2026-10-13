import { eq, inArray } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { donationPaymentChargebacks, donationPayments } from '$lib/server/db/schema';

export type MollieChargebackSnapshot = {
	id: string;
	amount: number;
	status: 'active' | 'reversed';
	mollieCreatedAt?: Date | null;
};

export type SyncDonationChargebacksInput = {
	paymentId: string;
	molliePaymentId: string;
	chargebacks: MollieChargebackSnapshot[];
};

/**
 * Synchronise l'instantané complet des chargebacks Mollie.
 *
 * Aucun appel réseau n'est effectué dans la transaction.
 * Aucun reçu fiscal n'est modifié à cette étape.
 */
export async function syncDonationPaymentChargebacks(input: SyncDonationChargebacksInput) {
	if (!input.paymentId || !input.molliePaymentId) {
		throw new Error('paymentId and molliePaymentId are required.');
	}

	if (!Array.isArray(input.chargebacks)) {
		throw new Error('chargebacks must be an array.');
	}

	const ids = new Set<string>();

	for (const chargeback of input.chargebacks) {
		if (!chargeback.id || ids.has(chargeback.id)) {
			throw new Error(`Missing or duplicate Mollie chargeback ID: ${chargeback.id}.`);
		}

		ids.add(chargeback.id);

		if (!Number.isSafeInteger(chargeback.amount) || chargeback.amount <= 0) {
			throw new Error(`Invalid chargeback amount for ${chargeback.id}.`);
		}

		if (typeof chargeback.status !== 'string' || !chargeback.status.trim()) {
			throw new Error(`Invalid chargeback status for ${chargeback.id}.`);
		}

		const date = chargeback.mollieCreatedAt;

		if (date != null && (!(date instanceof Date) || Number.isNaN(date.getTime()))) {
			throw new Error(`Invalid chargeback creation date for ${chargeback.id}.`);
		}
	}

	return db.transaction(async (tx) => {
		// Même convention de verrouillage que pour les remboursements.
		const [payment] = await tx
			.select()
			.from(donationPayments)
			.where(eq(donationPayments.id, input.paymentId))
			.for('update')
			.limit(1);

		if (!payment) {
			throw new Error(`Donation payment ${input.paymentId} not found.`);
		}

		if (payment.molliePaymentId !== input.molliePaymentId) {
			throw new Error('Mollie payment ID does not match the local payment.');
		}

		if (payment.status !== 'paid') {
			throw new Error('Chargeback reconciliation requires an originally paid payment.');
		}

		if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
			throw new Error('Invalid original payment amount.');
		}

		if (ids.size > 0) {
			const existing = await tx
				.select({
					id: donationPaymentChargebacks.mollieChargebackId,
					paymentId: donationPaymentChargebacks.paymentId
				})
				.from(donationPaymentChargebacks)
				.where(inArray(donationPaymentChargebacks.mollieChargebackId, [...ids]));

			if (existing.some((row) => row.paymentId !== input.paymentId)) {
				throw new Error('Chargeback belongs to a different payment.');
			}
		}

		const now = new Date();

		for (const chargeback of input.chargebacks) {
			await tx
				.insert(donationPaymentChargebacks)
				.values({
					paymentId: input.paymentId,
					mollieChargebackId: chargeback.id,
					amount: chargeback.amount,
					status: chargeback.status,
					mollieCreatedAt: chargeback.mollieCreatedAt ?? null,
					syncedAt: now
				})
				.onConflictDoUpdate({
					target: donationPaymentChargebacks.mollieChargebackId,
					set: {
						amount: chargeback.amount,
						status: chargeback.status,
						mollieCreatedAt: chargeback.mollieCreatedAt ?? null,
						syncedAt: now,
						updatedAt: now
					}
				});
		}

		// Conserver l'historique, mais refuser un instantané incomplet.
		const ledger = await tx
			.select()
			.from(donationPaymentChargebacks)
			.where(eq(donationPaymentChargebacks.paymentId, input.paymentId));

		if (ledger.some((row) => !ids.has(row.mollieChargebackId))) {
			throw new Error('Incomplete Mollie chargeback snapshot.');
		}

		return {
			paymentId: payment.id,
			chargebackCount: ledger.length,
			chargebacks: ledger.map((row) => ({
				id: row.mollieChargebackId,
				amount: row.amount,
				status: row.status
			}))
		};
	});
}
