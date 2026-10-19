import { describe, expect, it } from 'vitest';

import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';

import { donationPaymentChargebacks } from '$lib/server/db/schema';

import { syncDonationPaymentChargebacks } from '$lib/server/donations/chargebacks';

import { createPaidDonationFixture } from '../fixtures/donations';

describe('Donation chargebacks', () => {
	it('handles chargeback reversal and retries', async () => {
		const fixture = await createPaidDonationFixture();

		const chargebackId = `chb_test_${crypto.randomUUID()}`;

		const chargeback = {
			id: chargebackId,
			amount: fixture.amount,
			mollieCreatedAt: new Date('2026-10-17T10:00:00Z')
		};

		try {
			// 1. Chargeback actif.
			await syncDonationPaymentChargebacks({
				paymentId: fixture.paymentId,
				molliePaymentId: fixture.molliePaymentId,
				chargebacks: [
					{
						...chargeback,
						status: 'active'
					}
				]
			});

			let rows = await db
				.select()
				.from(donationPaymentChargebacks)
				.where(eq(donationPaymentChargebacks.paymentId, fixture.paymentId));

			expect(rows).toHaveLength(1);
			expect(rows[0].status).toBe('active');

			// 2. Contrepassation.
			await syncDonationPaymentChargebacks({
				paymentId: fixture.paymentId,
				molliePaymentId: fixture.molliePaymentId,
				chargebacks: [
					{
						...chargeback,
						status: 'reversed'
					}
				]
			});

			// 3. Retry du même instantané.
			await syncDonationPaymentChargebacks({
				paymentId: fixture.paymentId,
				molliePaymentId: fixture.molliePaymentId,
				chargebacks: [
					{
						...chargeback,
						status: 'reversed'
					}
				]
			});

			rows = await db
				.select()
				.from(donationPaymentChargebacks)
				.where(eq(donationPaymentChargebacks.paymentId, fixture.paymentId));

			expect(rows).toHaveLength(1);
			expect(rows[0].amount).toBe(2500);
			expect(rows[0].status).toBe('reversed');

			// 4. Instantané incomplet.
			await expect(
				syncDonationPaymentChargebacks({
					paymentId: fixture.paymentId,
					molliePaymentId: fixture.molliePaymentId,
					chargebacks: []
				})
			).rejects.toThrow('Incomplete Mollie chargeback snapshot');

			// 5. La transaction précédente est conservée.
			const finalRows = await db
				.select()
				.from(donationPaymentChargebacks)
				.where(eq(donationPaymentChargebacks.paymentId, fixture.paymentId));

			expect(finalRows).toHaveLength(1);
			expect(finalRows[0].status).toBe('reversed');
		} finally {
			// Supprimer les chargebacks avant le paiement.
			await db
				.delete(donationPaymentChargebacks)
				.where(eq(donationPaymentChargebacks.paymentId, fixture.paymentId));

			await fixture.cleanup();
		}
	});
});
