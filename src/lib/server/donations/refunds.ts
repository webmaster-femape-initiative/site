import { eq, inArray } from 'drizzle-orm';

import { db } from '$lib/server/db';

import { donationPaymentRefunds, donationPayments } from '$lib/server/db/schema';

/**
 * Statuts autorisés pour un remboursement.
 */
export type DonationRefundStatus =
	'queued' | 'pending' | 'processing' | 'refunded' | 'failed' | 'canceled';

export type MollieRefundSnapshot = {
	id: string;
	/** Montant en centimes d'euro. */
	amount: number;
	status: DonationRefundStatus;
	mollieCreatedAt?: Date | null;
	refundedAt?: Date | null;
};

export type SyncDonationRefundsInput = {
	paymentId: string;
	molliePaymentId: string;
	/** Instantané exhaustif des remboursements Mollie. */
	refunds: MollieRefundSnapshot[];
};

/**
 * Synchronise les remboursements Mollie dans une transaction.
 *
 * Responsabilités :
 * - vérifier la cohérence des données ;
 * - enregistrer les remboursements de manière idempotente ;
 * - conserver l'historique ;
 * - détecter les instantanés incomplets ;
 * - mettre à jour refundedAt lors d'un remboursement intégral.
 *
 * Aucun reçu fiscal n'est créé, annulé ou rectifié ici.
 *
 * Les données Mollie doivent être récupérées avant d'ouvrir
 * la transaction PostgreSQL.
 */
export async function syncDonationPaymentRefunds(input: SyncDonationRefundsInput) {
	if (!input.paymentId || !input.molliePaymentId) {
		throw new Error('paymentId and molliePaymentId are required.');
	}

	if (!Array.isArray(input.refunds)) {
		throw new Error('refunds must be an array.');
	}

	// ==========================================================
	// 1. Valider l'instantané Mollie
	// ==========================================================

	const ids = new Set<string>();

	const validStatuses: readonly DonationRefundStatus[] = [
		'queued',
		'pending',
		'processing',
		'refunded',
		'failed',
		'canceled'
	];

	for (const refund of input.refunds) {
		if (!refund.id || ids.has(refund.id)) {
			throw new Error(`Missing or duplicate Mollie refund ID: ${refund.id}.`);
		}

		ids.add(refund.id);

		if (!Number.isSafeInteger(refund.amount) || refund.amount <= 0) {
			throw new Error(`Invalid refund amount for ${refund.id}.`);
		}

		if (!validStatuses.includes(refund.status)) {
			throw new Error(`Invalid refund status for ${refund.id}: ${refund.status}.`);
		}

		if (refund.refundedAt != null && refund.status !== 'refunded') {
			throw new Error(`Refund date is only allowed for confirmed refund ${refund.id}.`);
		}

		for (const [field, date] of [
			['mollieCreatedAt', refund.mollieCreatedAt],
			['refundedAt', refund.refundedAt]
		] as const) {
			if (date != null && (!(date instanceof Date) || Number.isNaN(date.getTime()))) {
				throw new Error(`Invalid ${field} for refund ${refund.id}.`);
			}
		}
	}

	// ==========================================================
	// 2. Synchronisation transactionnelle
	// ==========================================================

	return db.transaction(async (tx) => {
		// Verrouiller le paiement en premier pour sérialiser
		// les traitements financiers concurrents.

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
			throw new Error('Refund synchronization requires an originally paid payment.');
		}

		if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
			throw new Error('Invalid original payment amount.');
		}

		// ======================================================
		// 3. Vérifier les identifiants déjà connus
		// ======================================================

		if (ids.size > 0) {
			const existing = await tx
				.select({
					paymentId: donationPaymentRefunds.paymentId
				})
				.from(donationPaymentRefunds)
				.where(inArray(donationPaymentRefunds.mollieRefundId, [...ids]));

			if (existing.some((row) => row.paymentId !== input.paymentId)) {
				throw new Error('Refund belongs to a different payment.');
			}
		}

		// ======================================================
		// 4. Insérer ou actualiser les remboursements
		// ======================================================

		for (const refund of input.refunds) {
			await tx
				.insert(donationPaymentRefunds)
				.values({
					paymentId: input.paymentId,
					mollieRefundId: refund.id,
					amount: refund.amount,
					status: refund.status,
					mollieCreatedAt: refund.mollieCreatedAt ?? null,
					refundedAt: refund.status === 'refunded' ? (refund.refundedAt ?? null) : null
				})
				.onConflictDoUpdate({
					target: donationPaymentRefunds.mollieRefundId,
					set: {
						amount: refund.amount,
						status: refund.status,
						mollieCreatedAt: refund.mollieCreatedAt ?? null,
						refundedAt: refund.status === 'refunded' ? (refund.refundedAt ?? null) : null,
						updatedAt: new Date()
					}
				});
		}

		// ======================================================
		// 5. Vérifier que l'instantané est exhaustif
		// ======================================================

		const ledger = await tx
			.select()
			.from(donationPaymentRefunds)
			.where(eq(donationPaymentRefunds.paymentId, input.paymentId));

		// Ne jamais effacer les remboursements historiques.
		// Si Mollie renvoie une liste incomplète, la transaction
		// doit échouer pour éviter un calcul financier erroné.

		if (ledger.some((row) => !ids.has(row.mollieRefundId))) {
			throw new Error('Incomplete Mollie refund snapshot.');
		}

		// ======================================================
		// 6. Calculer le montant confirmé remboursé
		// ======================================================

		const refundedCents = ledger
			.filter((row) => row.status === 'refunded')
			.reduce((total, row) => total + row.amount, 0);

		if (!Number.isSafeInteger(refundedCents) || refundedCents > payment.amount) {
			throw new Error('Confirmed refunds exceed original payment amount.');
		}

		const remainingAmount = payment.amount - refundedCents;

		// ======================================================
		// 7. Enregistrer le remboursement intégral
		// ======================================================

		if (remainingAmount === 0 && !payment.refundedAt) {
			await tx
				.update(donationPayments)
				.set({
					refundedAt: new Date()
				})
				.where(eq(donationPayments.id, payment.id));
		}

		return {
			paymentId: payment.id,
			refundedCents,
			remainingAmount
		};
	});
}
