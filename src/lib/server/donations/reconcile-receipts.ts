import { and, desc, eq } from 'drizzle-orm';

import { db } from '$lib/server/db';

import {
	donationPayments,
	donationPaymentRefunds,
	donationPaymentChargebacks,
	donationReceipts
} from '$lib/server/db/schema';

import { calculatePaymentNetAmount } from './payment-net-amounts';
import {
	donationReceiptCancellationFields,
	donationReceiptRevisionValues,
	createDonationReceiptForPaymentTx
} from './receipts';

export async function reconcileDonationPaymentReceipt(paymentId: string) {
	return db.transaction(async (tx) => {
		// Le verrou du paiement sérialise les réconciliations.
		const [payment] = await tx
			.select()
			.from(donationPayments)
			.where(eq(donationPayments.id, paymentId))
			.for('update')
			.limit(1);

		if (!payment) {
			throw new Error(`Donation payment ${paymentId} not found.`);
		}

		if (payment.status !== 'paid') {
			throw new Error(`Cannot reconcile receipt: payment ${paymentId} is not paid.`);
		}

		const refunds = await tx
			.select({
				amount: donationPaymentRefunds.amount,
				status: donationPaymentRefunds.status
			})
			.from(donationPaymentRefunds)
			.where(eq(donationPaymentRefunds.paymentId, paymentId));

		const chargebacks = await tx
			.select({
				amount: donationPaymentChargebacks.amount,
				status: donationPaymentChargebacks.status
			})
			.from(donationPaymentChargebacks)
			.where(eq(donationPaymentChargebacks.paymentId, paymentId));

		const refundedAmount = refunds
			.filter((refund) => refund.status === 'refunded')
			.reduce((sum, refund) => sum + refund.amount, 0);

		const activeChargebackAmount = chargebacks
			.filter((chargeback) => chargeback.status === 'active')
			.reduce((sum, chargeback) => sum + chargeback.amount, 0);

		const financial = calculatePaymentNetAmount({
			paymentAmount: payment.amount,
			refundedAmount,
			activeChargebackAmount
		});

		const [currentReceipt] = await tx
			.select()
			.from(donationReceipts)
			.where(and(eq(donationReceipts.paymentId, paymentId), eq(donationReceipts.status, 'valid')))
			.for('update')
			.limit(1);

		const [latestReceipt] = await tx
			.select()
			.from(donationReceipts)
			.where(eq(donationReceipts.paymentId, paymentId))
			.orderBy(desc(donationReceipts.revisionNumber))
			.limit(1);

		if (!currentReceipt && !latestReceipt) {
			if (financial.netAmount === 0) {
				return {
					...financial,
					action: 'unchanged' as const,
					receiptId: null
				};
			}

			const receipt = await createDonationReceiptForPaymentTx(tx, paymentId);

			return {
				...financial,
				action: receipt ? ('created' as const) : ('unchanged' as const),
				receiptId: receipt?.id ?? null
			};
		}

		// Un reçu a été annulé sans remplacement.
		// On ne le recrée jamais automatiquement.
		if (!currentReceipt) {
			if (financial.netAmount > 0) {
				return {
					...financial,
					action: 'manual_review_required' as const,
					receiptId: latestReceipt?.id ?? null
				};
			}

			return {
				...financial,
				action: 'unchanged' as const,
				receiptId: latestReceipt?.id ?? null
			};
		}

		if (currentReceipt.amount === financial.netAmount) {
			return {
				...financial,
				action: 'unchanged' as const,
				receiptId: currentReceipt.id
			};
		}

		// Un renversement de chargeback peut augmenter le net.
		// Nous ne réémettons pas automatiquement un reçu majoré.
		if (financial.netAmount > currentReceipt.amount) {
			return {
				...financial,
				action: 'manual_review_required' as const,
				receiptId: currentReceipt.id
			};
		}

		const cancellationReason = activeChargebackAmount > 0 ? 'chargeback' : 'refund';

		const [cancelledReceipt] = await tx
			.update(donationReceipts)
			.set(donationReceiptCancellationFields(cancellationReason))
			.where(and(eq(donationReceipts.id, currentReceipt.id), eq(donationReceipts.status, 'valid')))
			.returning();

		if (!cancelledReceipt) {
			throw new Error(`Unable to cancel donation receipt ${currentReceipt.id}.`);
		}

		if (financial.netAmount === 0) {
			return {
				...financial,
				action: 'cancelled' as const,
				receiptId: null
			};
		}

		// La nouvelle révision reprend les données historiques
		// du reçu précédent, pas les paramètres actuels.
		const [replacement] = await tx
			.insert(donationReceipts)
			.values(donationReceiptRevisionValues(currentReceipt, financial.netAmount))
			.returning();

		if (!replacement) {
			throw new Error(`Unable to create replacement receipt for ${paymentId}.`);
		}

		return {
			...financial,
			action: 'replaced' as const,
			receiptId: replacement.id
		};
	});
}
