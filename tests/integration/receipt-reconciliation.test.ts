import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { eq, asc } from 'drizzle-orm';

import { db } from '$lib/server/db';

import {
	donationReceipts,
	donationPaymentRefunds,
	donationPaymentChargebacks
} from '$lib/server/db/schema';

import { reconcileDonationPaymentReceipt } from '$lib/server/donations/reconcile-receipts';

import { createPaidDonationFixture, type PaidDonationFixture } from '../fixtures/donations';

import { createReceiptSettingsFixture, cleanupPaymentReceipts } from '../fixtures/receipts';

import { syncDonationPaymentRefunds } from '$lib/server/donations/refunds';

import { syncDonationPaymentChargebacks } from '$lib/server/donations/chargebacks';

describe('Donation receipt reconciliation', () => {
	let payment: PaidDonationFixture;
	let settings: Awaited<ReturnType<typeof createReceiptSettingsFixture>>;

	async function getReceipts() {
		return db
			.select()
			.from(donationReceipts)
			.where(eq(donationReceipts.paymentId, payment.paymentId))
			.orderBy(asc(donationReceipts.revisionNumber));
	}

	beforeEach(async () => {
		settings = await createReceiptSettingsFixture();
		payment = await createPaidDonationFixture();
	});

	afterEach(async () => {
		if (payment) {
			await cleanupPaymentReceipts(payment.paymentId);

			await db
				.delete(donationPaymentRefunds)
				.where(eq(donationPaymentRefunds.paymentId, payment.paymentId));

			await db
				.delete(donationPaymentChargebacks)
				.where(eq(donationPaymentChargebacks.paymentId, payment.paymentId));

			await payment.cleanup();
		}

		if (settings) {
			await settings.cleanup();
		}
	});

	it('creates an initial receipt', async () => {
		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('created');
		expect(result.netAmount).toBe(2500);

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(1);
		expect(receipts[0].amount).toBe(2500);
		expect(receipts[0].revisionNumber).toBe(1);
		expect(receipts[0].status).toBe('valid');
		expect(receipts[0].replacesReceiptId).toBeNull();
	});

	it('is idempotent when reconciled repeatedly', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		const second = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(second.action).toBe('unchanged');

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(1);
		expect(receipts[0].status).toBe('valid');
	});

	it('replaces a receipt after a partial refund', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		const [original] = await getReceipts();

		await syncDonationPaymentRefunds({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			refunds: [
				{
					id: `re_test_${crypto.randomUUID()}`,
					amount: 1000,
					status: 'refunded',
					refundedAt: new Date()
				}
			]
		});

		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('replaced');
		expect(result.refundedAmount).toBe(1000);
		expect(result.netAmount).toBe(1500);

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(2);

		expect(receipts[0].id).toBe(original.id);
		expect(receipts[0].status).toBe('cancelled');
		expect(receipts[0].cancellationReason).toBe('refund');
		expect(receipts[0].cancelledAt).toBeInstanceOf(Date);

		expect(receipts[1].status).toBe('valid');
		expect(receipts[1].amount).toBe(1500);
		expect(receipts[1].revisionNumber).toBe(2);
		expect(receipts[1].replacesReceiptId).toBe(original.id);

		// Les informations fiscales historiques sont conservées.
		expect(receipts[1].settingsId).toBe(original.settingsId);
		expect(receipts[1].taxArticle).toBe(original.taxArticle);
		expect(receipts[1].donorFirstName).toBe(original.donorFirstName);
		expect(receipts[1].organizationName).toBe(original.organizationName);

		// Le document de remplacement doit être généré.
		expect(receipts[1].documentStatus).toBe('pending');
		expect(receipts[1].document).toBeNull();
	});

	it('cancels the receipt after a full refund', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		const [original] = await getReceipts();

		await syncDonationPaymentRefunds({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			refunds: [
				{
					id: `re_test_${crypto.randomUUID()}`,
					amount: 2500,
					status: 'refunded',
					refundedAt: new Date()
				}
			]
		});

		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('cancelled');
		expect(result.refundedAmount).toBe(2500);
		expect(result.netAmount).toBe(0);
		expect(result.receiptId).toBeNull();

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(1);
		expect(receipts[0].id).toBe(original.id);
		expect(receipts[0].status).toBe('cancelled');
		expect(receipts[0].cancellationReason).toBe('refund');
		expect(receipts[0].cancelledDocumentStatus).toBe('pending');
	});

	it('replaces the receipt after a partial chargeback', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		const [original] = await getReceipts();

		await syncDonationPaymentChargebacks({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			chargebacks: [
				{
					id: `chb_test_${crypto.randomUUID()}`,
					amount: 1000,
					status: 'active'
				}
			]
		});

		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('replaced');
		expect(result.activeChargebackAmount).toBe(1000);
		expect(result.netAmount).toBe(1500);

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(2);

		expect(receipts[0].status).toBe('cancelled');
		expect(receipts[0].cancellationReason).toBe('chargeback');

		expect(receipts[1].status).toBe('valid');
		expect(receipts[1].amount).toBe(1500);
		expect(receipts[1].revisionNumber).toBe(2);
		expect(receipts[1].replacesReceiptId).toBe(original.id);
	});

	it('cancels the receipt after a full chargeback', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		await syncDonationPaymentChargebacks({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			chargebacks: [
				{
					id: `chb_test_${crypto.randomUUID()}`,
					amount: 2500,
					status: 'active'
				}
			]
		});

		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('cancelled');
		expect(result.netAmount).toBe(0);
		expect(result.receiptId).toBeNull();

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(1);
		expect(receipts[0].status).toBe('cancelled');
		expect(receipts[0].cancellationReason).toBe('chargeback');
	});

	it('requires manual review when a partial chargeback is reversed', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		const chargebackId = `chb_test_${crypto.randomUUID()}`;

		await syncDonationPaymentChargebacks({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			chargebacks: [
				{
					id: chargebackId,
					amount: 1000,
					status: 'active'
				}
			]
		});

		await reconcileDonationPaymentReceipt(payment.paymentId);

		await syncDonationPaymentChargebacks({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			chargebacks: [
				{
					id: chargebackId,
					amount: 1000,
					status: 'reversed'
				}
			]
		});

		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('manual_review_required');
		expect(result.activeChargebackAmount).toBe(0);
		expect(result.netAmount).toBe(2500);

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(2);
		expect(receipts[0].status).toBe('cancelled');
		expect(receipts[1].status).toBe('valid');
		expect(receipts[1].amount).toBe(1500);
	});

	it('does not recreate a receipt after reversing a full chargeback', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		const chargebackId = `chb_test_${crypto.randomUUID()}`;

		await syncDonationPaymentChargebacks({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			chargebacks: [
				{
					id: chargebackId,
					amount: 2500,
					status: 'active'
				}
			]
		});

		await reconcileDonationPaymentReceipt(payment.paymentId);

		await syncDonationPaymentChargebacks({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			chargebacks: [
				{
					id: chargebackId,
					amount: 2500,
					status: 'reversed'
				}
			]
		});

		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('manual_review_required');
		expect(result.netAmount).toBe(2500);

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(1);
		expect(receipts[0].status).toBe('cancelled');
	});

	it('is idempotent after a full chargeback cancellation', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		await syncDonationPaymentChargebacks({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			chargebacks: [
				{
					id: `chb_test_${crypto.randomUUID()}`,
					amount: 2500,
					status: 'active'
				}
			]
		});

		const first = await reconcileDonationPaymentReceipt(payment.paymentId);

		const second = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(first.action).toBe('cancelled');
		expect(second.action).toBe('unchanged');
		expect(second.netAmount).toBe(0);

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(1);
		expect(receipts[0].status).toBe('cancelled');
	});

	it('replaces a receipt when the net amount is 1 euro', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		const [original] = await getReceipts();

		await syncDonationPaymentRefunds({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			refunds: [
				{
					id: `re_test_${crypto.randomUUID()}`,
					amount: 2400,
					status: 'refunded',
					refundedAt: new Date()
				}
			]
		});

		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('replaced');
		expect(result.refundedAmount).toBe(2400);
		expect(result.netAmount).toBe(100);

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(2);

		expect(receipts[0].id).toBe(original.id);
		expect(receipts[0].status).toBe('cancelled');
		expect(receipts[0].cancellationReason).toBe('refund');

		expect(receipts[1].status).toBe('valid');
		expect(receipts[1].amount).toBe(100);
		expect(receipts[1].revisionNumber).toBe(2);
		expect(receipts[1].replacesReceiptId).toBe(original.id);
	});

	it('replaces a receipt when the net amount is 1 cent', async () => {
		await reconcileDonationPaymentReceipt(payment.paymentId);

		const [original] = await getReceipts();

		await syncDonationPaymentRefunds({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			refunds: [
				{
					id: `re_test_${crypto.randomUUID()}`,
					amount: 2499,
					status: 'refunded',
					refundedAt: new Date()
				}
			]
		});

		const result = await reconcileDonationPaymentReceipt(payment.paymentId);

		expect(result.action).toBe('replaced');
		expect(result.refundedAmount).toBe(2499);
		expect(result.netAmount).toBe(1);

		const receipts = await getReceipts();

		expect(receipts).toHaveLength(2);

		expect(receipts[0].status).toBe('cancelled');

		expect(receipts[1].status).toBe('valid');
		expect(receipts[1].amount).toBe(1);
		expect(receipts[1].revisionNumber).toBe(2);
		expect(receipts[1].replacesReceiptId).toBe(original.id);

		expect(receipts[1].documentStatus).toBe('pending');
	});
});
