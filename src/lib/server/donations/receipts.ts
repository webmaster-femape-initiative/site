import { and, desc, eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	donationPayments,
	donationReceipts,
	donationReceiptSettings,
	donationPaymentRefunds,
	donationPaymentChargebacks
} from '$lib/server/db/schema';

import { calculatePaymentNetAmount } from './payment-net-amounts';

type DonationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type DonationReceiptCancellationReason = 'refund' | 'chargeback' | 'manual';

export type CancelDonationReceiptOptions = {
	reason: DonationReceiptCancellationReason;
	comment?: string | null;
};

export type RectifyDonationReceiptOptions = CancelDonationReceiptOptions & {
	/** Identifiant du reçu valide observé avant la rectification. */
	expectedReceiptId: string;
	/** Montant net confirmé, en centimes, après l'opération financière. */
	remainingAmount: number;
};

function validateCancellationOptions(options: CancelDonationReceiptOptions) {
	if (!['refund', 'chargeback', 'manual'].includes(options.reason)) {
		throw new Error(`Invalid donation receipt cancellation reason: ${options.reason}.`);
	}
	return options.comment?.trim() || null;
}

export function donationReceiptCancellationFields(
	reason: DonationReceiptCancellationReason,
	comment: string | null = null
) {
	return {
		status: 'cancelled' as const,
		cancelledAt: new Date(),
		cancellationReason: reason,
		cancellationComment: comment,
		cancelledDocumentStatus: 'pending' as const,
		cancelledDocument: null,
		cancelledDocumentMimeType: null,
		cancelledDocumentError: null,
		cancelledDocumentGeneratedAt: null
	};
}

/** Retourne uniquement le reçu actuellement valide, ou null. */
export async function getDonationReceiptByPaymentId(paymentId: string) {
	const [receipt] = await db
		.select()
		.from(donationReceipts)
		.where(and(eq(donationReceipts.paymentId, paymentId), eq(donationReceipts.status, 'valid')))
		.limit(1);

	return receipt ?? null;
}

/** Retourne toutes les révisions, y compris les reçus annulés. */
export async function getDonationReceiptHistoryByPaymentId(paymentId: string) {
	return db
		.select()
		.from(donationReceipts)
		.where(eq(donationReceipts.paymentId, paymentId))
		.orderBy(desc(donationReceipts.revisionNumber));
}

/**
 * Crée uniquement le premier reçu fiscal d'un paiement encaissé.
 * Ne recrée jamais un reçu initial après son annulation.
 */
export async function createDonationReceiptForPaymentTx(
	tx: DonationTransaction,
	paymentId: string
) {
	const [payment] = await tx
		.select()
		.from(donationPayments)
		.where(eq(donationPayments.id, paymentId))
		.for('update')
		.limit(1);

	if (!payment) throw new Error(`Donation payment ${paymentId} not found.`);
	if (payment.status !== 'paid') {
		throw new Error(
			`Cannot create donation receipt for payment ${paymentId}: payment status is ${payment.status}.`
		);
	}

	// Un reçu annulé compte comme un reçu déjà émis : ne jamais le recréer.
	const [existingReceipt] = await tx
		.select()
		.from(donationReceipts)
		.where(eq(donationReceipts.paymentId, payment.id))
		.orderBy(desc(donationReceipts.revisionNumber))
		.limit(1);

	if (existingReceipt) return existingReceipt;

	if (!payment.paidAt) {
		throw new Error(`Cannot create donation receipt for payment ${paymentId}: paidAt is missing.`);
	}
	if (!payment.molliePaymentMethod) {
		throw new Error(
			`Cannot create donation receipt for payment ${paymentId}: Mollie payment method is unavailable.`
		);
	}
	if (!Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
		throw new Error(`Invalid amount for donation payment ${paymentId}.`);
	}
	// Ne pas émettre un reçu initial pour un paiement déjà remboursé intégralement.
	if (payment.refundedAt) {
		throw new Error(`Cannot create donation receipt for fully refunded payment ${paymentId}.`);
	}

	const [refundTotals] = await tx
		.select({
			amount: sql<number>`
            coalesce(
                sum(${donationPaymentRefunds.amount}),
                0
            )
        `.mapWith(Number)
		})
		.from(donationPaymentRefunds)
		.where(
			sql`
            ${donationPaymentRefunds.paymentId} = ${payment.id}
            AND ${donationPaymentRefunds.status} = 'refunded'
        `
		);

	const refundedAmount = refundTotals?.amount ?? 0;

	if (
		!Number.isSafeInteger(refundedAmount) ||
		refundedAmount < 0 ||
		refundedAmount > payment.amount
	) {
		throw new Error(`Invalid confirmed refund total for payment ${paymentId}.`);
	}

	const [chargebackTotals] = await tx
		.select({
			amount: sql<number>`
            coalesce(sum(${donationPaymentChargebacks.amount}), 0)
        `.mapWith(Number)
		})
		.from(donationPaymentChargebacks)
		.where(
			and(
				eq(donationPaymentChargebacks.paymentId, payment.id),
				eq(donationPaymentChargebacks.status, 'active')
			)
		);

	const activeChargebackAmount = chargebackTotals?.amount ?? 0;

	const { netAmount } = calculatePaymentNetAmount({
		paymentAmount: payment.amount,
		refundedAmount,
		activeChargebackAmount
	});

	if (netAmount === 0) {
		return null;
	}

	const [settings] = await tx
		.select()
		.from(donationReceiptSettings)
		.where(eq(donationReceiptSettings.isActive, true))
		.limit(1);

	if (!settings) {
		throw new Error('Cannot create donation receipt: no active receipt settings.');
	}

	const [receipt] = await tx
		.insert(donationReceipts)
		.values({
			paymentId: payment.id,
			revisionNumber: 1,
			replacesReceiptId: null,
			settingsId: settings.id,
			amount: netAmount,
			donationDate: payment.paidAt,
			donationForm: 'manual-donation',
			donationNature: 'money',
			paymentMode: payment.molliePaymentMethod,
			taxArticle: settings.taxArticle,
			donorFirstName: payment.donorFirstName,
			donorLastName: payment.donorLastName,
			donorAddress: payment.donorAddress,
			donorPostalCode: payment.donorPostalCode,
			donorCity: payment.donorCity,
			donorCountry: payment.donorCountry,
			organizationName: settings.organizationName,
			organizationSiren: settings.siren,
			organizationRna: settings.rna,
			organizationAddress: settings.address,
			organizationPostalCode: settings.postalCode,
			organizationCity: settings.city,
			organizationCountry: settings.country,
			organizationPurpose: settings.organizationPurpose,
			organizationCategory: settings.organizationCategory,
			signatoryName: settings.signatoryName,
			signatoryFunction: settings.signatoryFunction,
			signature: settings.signature,
			signatureMimeType: settings.signatureMimeType,
			documentStatus: 'pending',
			document: null,
			documentMimeType: null,
			documentError: null,
			documentGeneratedAt: null
		})
		.returning();

	if (!receipt) throw new Error(`Unable to create donation receipt for payment ${paymentId}.`);
	return receipt;
}

/**
 * Annule le reçu actuellement valide, sans créer de remplacement.
 * À utiliser uniquement après validation métier d'une annulation définitive.
 */
export async function cancelDonationReceiptForPayment(
	paymentId: string,
	options: CancelDonationReceiptOptions
) {
	const comment = validateCancellationOptions(options);

	return db.transaction(async (tx) => {
		const [payment] = await tx
			.select()
			.from(donationPayments)
			.where(eq(donationPayments.id, paymentId))
			.for('update')
			.limit(1);

		if (!payment) throw new Error(`Donation payment ${paymentId} not found.`);

		const [currentReceipt] = await tx
			.select()
			.from(donationReceipts)
			.where(and(eq(donationReceipts.paymentId, paymentId), eq(donationReceipts.status, 'valid')))
			.for('update')
			.limit(1);

		if (!currentReceipt) {
			// Idempotence : une annulation déjà effectuée ne doit pas être rejouée.
			const [latestReceipt] = await tx
				.select()
				.from(donationReceipts)
				.where(eq(donationReceipts.paymentId, paymentId))
				.orderBy(desc(donationReceipts.revisionNumber))
				.limit(1);

			if (!latestReceipt) {
				throw new Error(
					`Cannot cancel donation receipt: no receipt found for payment ${paymentId}.`
				);
			}
			return latestReceipt;
		}

		const [cancelledReceipt] = await tx
			.update(donationReceipts)
			.set(donationReceiptCancellationFields(options.reason, comment))
			.where(and(eq(donationReceipts.id, currentReceipt.id), eq(donationReceipts.status, 'valid')))
			.returning();

		if (!cancelledReceipt) {
			throw new Error(`Unable to cancel donation receipt ${currentReceipt.id}.`);
		}
		return cancelledReceipt;
	});
}

/**
 * Remplace un reçu valide par une nouvelle révision au montant net confirmé.
 * L'appelant doit calculer remainingAmount à partir des opérations Mollie
 * confirmées, et fournir l'identifiant du reçu qu'il s'attend à remplacer.
 * Ne pas appeler directement depuis le webhook avant la mise en place du ledger.
 */
export async function rectifyDonationReceiptForPayment(
	paymentId: string,
	options: RectifyDonationReceiptOptions
) {
	const comment = validateCancellationOptions(options);
	if (!options.expectedReceiptId) throw new Error('expectedReceiptId is required.');
	if (!Number.isSafeInteger(options.remainingAmount) || options.remainingAmount < 0) {
		throw new Error('remainingAmount must be a non-negative integer of cents.');
	}

	return db.transaction(async (tx) => {
		const [payment] = await tx
			.select()
			.from(donationPayments)
			.where(eq(donationPayments.id, paymentId))
			.for('update')
			.limit(1);

		if (!payment) throw new Error(`Donation payment ${paymentId} not found.`);
		if (payment.status !== 'paid') {
			throw new Error(`Cannot rectify receipt: payment ${paymentId} is not paid.`);
		}
		if (options.remainingAmount > payment.amount) {
			throw new Error('remainingAmount exceeds the original payment amount.');
		}

		const [expected] = await tx
			.select()
			.from(donationReceipts)
			.where(
				and(
					eq(donationReceipts.id, options.expectedReceiptId),
					eq(donationReceipts.paymentId, paymentId)
				)
			)
			.for('update')
			.limit(1);

		if (!expected) throw new Error('Expected receipt not found for payment.');

		// Répétition exacte d'une rectification déjà exécutée.
		if (expected.status === 'cancelled') {
			const [replacement] = await tx
				.select()
				.from(donationReceipts)
				.where(eq(donationReceipts.replacesReceiptId, expected.id))
				.limit(1);

			if (replacement && replacement.amount === options.remainingAmount) {
				return replacement;
			}
			if (!replacement && options.remainingAmount === 0) return null;
			throw new Error('Stale receipt revision: reconciliation required.');
		}

		const [current] = await tx
			.select()
			.from(donationReceipts)
			.where(and(eq(donationReceipts.paymentId, paymentId), eq(donationReceipts.status, 'valid')))
			.limit(1);

		if (!current || current.id !== expected.id) {
			throw new Error('Receipt revision changed: reconciliation required.');
		}
		if (options.remainingAmount >= current.amount) {
			throw new Error('Rectification must reduce the current receipt amount.');
		}

		const [cancelled] = await tx
			.update(donationReceipts)
			.set(donationReceiptCancellationFields(options.reason, comment))
			.where(and(eq(donationReceipts.id, current.id), eq(donationReceipts.status, 'valid')))
			.returning();

		if (!cancelled) throw new Error(`Unable to cancel receipt ${current.id}.`);
		if (options.remainingAmount === 0) return null;

		// Le nouveau reçu reprend les snapshots du reçu précédent, et non
		// les coordonnées actuelles du donateur ou les paramètres actifs.
		const [replacement] = await tx
			.insert(donationReceipts)
			.values(donationReceiptRevisionValues(current, options.remainingAmount))
			.returning();

		if (!replacement)
			throw new Error(`Unable to create replacement receipt for payment ${paymentId}.`);
		return replacement;
	});
}

type DonationReceipt = typeof donationReceipts.$inferSelect;

export function donationReceiptRevisionValues(current: DonationReceipt, amount: number) {
	if (!Number.isSafeInteger(amount) || amount <= 0) {
		throw new Error('Replacement receipt amount must be a positive integer of cents.');
	}

	return {
		paymentId: current.paymentId,
		settingsId: current.settingsId,
		replacesReceiptId: current.id,
		revisionNumber: current.revisionNumber + 1,
		amount,

		donationDate: current.donationDate,
		donationForm: current.donationForm,
		donationNature: current.donationNature,
		paymentMode: current.paymentMode,
		taxArticle: current.taxArticle,

		donorFirstName: current.donorFirstName,
		donorLastName: current.donorLastName,
		donorAddress: current.donorAddress,
		donorPostalCode: current.donorPostalCode,
		donorCity: current.donorCity,
		donorCountry: current.donorCountry,

		organizationName: current.organizationName,
		organizationSiren: current.organizationSiren,
		organizationRna: current.organizationRna,
		organizationAddress: current.organizationAddress,
		organizationPostalCode: current.organizationPostalCode,
		organizationCity: current.organizationCity,
		organizationCountry: current.organizationCountry,
		organizationPurpose: current.organizationPurpose,
		organizationCategory: current.organizationCategory,

		signatoryName: current.signatoryName,
		signatoryFunction: current.signatoryFunction,
		signature: current.signature,
		signatureMimeType: current.signatureMimeType,

		documentStatus: 'pending' as const,
		document: null,
		documentMimeType: null,
		documentError: null,
		documentGeneratedAt: null
	};
}

export async function createDonationReceiptForPayment(paymentId: string) {
	return db.transaction(async (tx) => {
		return createDonationReceiptForPaymentTx(tx, paymentId);
	});
}
