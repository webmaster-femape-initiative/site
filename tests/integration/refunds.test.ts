import { describe, expect, it, afterEach } from 'vitest';

import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';

import { donationPayments, donationPaymentRefunds } from '$lib/server/db/schema';

import { syncDonationPaymentRefunds } from '$lib/server/donations/refunds';

import { createPaidDonationFixture, type PaidDonationFixture } from '../fixtures/donations';

describe('Donation refunds', () => {
	let fixture: PaidDonationFixture | undefined;

	async function createFixture() {
		fixture = await createPaidDonationFixture();
		return fixture;
	}

	async function getRefunds(paymentId: string) {
		return db
			.select()
			.from(donationPaymentRefunds)
			.where(eq(donationPaymentRefunds.paymentId, paymentId));
	}

	async function synchronize(
		payment: PaidDonationFixture,
		refunds: Parameters<typeof syncDonationPaymentRefunds>[0]['refunds']
	) {
		return syncDonationPaymentRefunds({
			paymentId: payment.paymentId,
			molliePaymentId: payment.molliePaymentId,
			refunds
		});
	}

	afterEach(async () => {
		if (!fixture) return;

		try {
			await db
				.delete(donationPaymentRefunds)
				.where(eq(donationPaymentRefunds.paymentId, fixture.paymentId));

			await fixture.cleanup();
		} finally {
			fixture = undefined;
		}
	});

	it('synchronizes a partial refund', async () => {
		const payment = await createFixture();

		const result = await synchronize(payment, [
			{
				id: `re_test_${crypto.randomUUID()}`,
				amount: 1000,
				status: 'refunded',
				refundedAt: new Date()
			}
		]);

		expect(result.refundedCents).toBe(1000);
		expect(result.remainingAmount).toBe(1500);

		const [storedPayment] = await db
			.select()
			.from(donationPayments)
			.where(eq(donationPayments.id, payment.paymentId));

		expect(storedPayment.refundedAt).toBeNull();
	});

	it('marks a fully refunded payment', async () => {
		const payment = await createFixture();

		const result = await synchronize(payment, [
			{
				id: `re_test_${crypto.randomUUID()}`,
				amount: 2500,
				status: 'refunded',
				refundedAt: new Date()
			}
		]);

		expect(result.refundedCents).toBe(2500);
		expect(result.remainingAmount).toBe(0);

		const [storedPayment] = await db
			.select()
			.from(donationPayments)
			.where(eq(donationPayments.id, payment.paymentId));

		expect(storedPayment.refundedAt).toBeInstanceOf(Date);
	});

	it('counts only confirmed refunds', async () => {
		const payment = await createFixture();

		const refundId = `re_test_${crypto.randomUUID()}`;

		const pendingResult = await synchronize(payment, [
			{
				id: refundId,
				amount: 1000,
				status: 'pending'
			}
		]);

		expect(pendingResult.refundedCents).toBe(0);
		expect(pendingResult.remainingAmount).toBe(2500);

		const confirmedResult = await synchronize(payment, [
			{
				id: refundId,
				amount: 1000,
				status: 'refunded',
				refundedAt: new Date()
			}
		]);

		expect(confirmedResult.refundedCents).toBe(1000);
		expect(confirmedResult.remainingAmount).toBe(1500);

		const rows = await getRefunds(payment.paymentId);

		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe('refunded');
	});

	it('is idempotent when receiving the same snapshot', async () => {
		const payment = await createFixture();

		const refunds = [
			{
				id: `re_test_${crypto.randomUUID()}`,
				amount: 500,
				status: 'refunded' as const,
				refundedAt: new Date()
			}
		];

		await synchronize(payment, refunds);
		const result = await synchronize(payment, refunds);

		const rows = await getRefunds(payment.paymentId);

		expect(rows).toHaveLength(1);
		expect(result.refundedCents).toBe(500);
		expect(result.remainingAmount).toBe(2000);
	});

	it('rejects an incomplete refund snapshot', async () => {
		const payment = await createFixture();

		const refunds = [
			{
				id: `re_test_${crypto.randomUUID()}`,
				amount: 1000,
				status: 'refunded' as const,
				refundedAt: new Date()
			}
		];

		await synchronize(payment, refunds);

		await expect(synchronize(payment, [])).rejects.toThrow('Incomplete Mollie refund snapshot.');

		const rows = await getRefunds(payment.paymentId);

		expect(rows).toHaveLength(1);
		expect(rows[0].amount).toBe(1000);
	});

	it('rolls back when confirmed refunds exceed payment amount', async () => {
		const payment = await createFixture();

		await expect(
			synchronize(payment, [
				{
					id: `re_test_${crypto.randomUUID()}`,
					amount: 3000,
					status: 'refunded',
					refundedAt: new Date()
				}
			])
		).rejects.toThrow('Confirmed refunds exceed original payment amount.');

		const rows = await getRefunds(payment.paymentId);

		expect(rows).toHaveLength(0);
	});

	it('rejects a mismatched Mollie payment ID', async () => {
		const payment = await createFixture();

		await expect(
			syncDonationPaymentRefunds({
				paymentId: payment.paymentId,
				molliePaymentId: 'tr_invalid',
				refunds: [
					{
						id: `re_test_${crypto.randomUUID()}`,
						amount: 500,
						status: 'refunded',
						refundedAt: new Date()
					}
				]
			})
		).rejects.toThrow('Mollie payment ID does not match the local payment.');

		const rows = await getRefunds(payment.paymentId);

		expect(rows).toHaveLength(0);
	});
});
