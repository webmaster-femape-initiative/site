import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { eq, asc } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { donationPayments } from '$lib/server/db/schema';

import { createRecurringDonationPayment } from '$lib/server/donations/payments';

import {
	createRecurringDonationFixture,
	type RecurringDonationFixture
} from '../fixtures/recurring-donations';

// ============================================================
// HELPERS
// ============================================================

function newMolliePaymentId(): string {
	return `tr_test_${crypto.randomUUID()}`;
}

function recurringPaymentData(fixture: RecurringDonationFixture, molliePaymentId: string) {
	return {
		donationId: fixture.donationId,
		molliePaymentId,
		mollieCreatedAt: new Date(),
		molliePaymentMethod: 'creditcard',
		amount: fixture.amount,
		status: 'paid' as const,
		paidAt: new Date()
	};
}

async function getDonationPayments(donationId: string) {
	return db
		.select()
		.from(donationPayments)
		.where(eq(donationPayments.donationId, donationId))
		.orderBy(asc(donationPayments.sequenceNumber));
}

// ============================================================
// TESTS
// ============================================================

describe('Recurring donation payment idempotency', () => {
	let fixture: RecurringDonationFixture;

	beforeEach(async () => {
		fixture = await createRecurringDonationFixture();
	});

	afterEach(async () => {
		if (fixture) {
			await fixture.cleanup();
		}
	});

	// ========================================================
	// 1. PREMIÈRE CRÉATION
	// ========================================================

	it('creates a new recurring payment', async () => {
		const molliePaymentId = newMolliePaymentId();

		const payment = await createRecurringDonationPayment(
			recurringPaymentData(fixture, molliePaymentId)
		);

		expect(payment.donationId).toBe(fixture.donationId);
		expect(payment.molliePaymentId).toBe(molliePaymentId);
		expect(payment.sequenceNumber).toBe(2);
		expect(payment.amount).toBe(2500);
		expect(payment.status).toBe('paid');

		const payments = await getDonationPayments(fixture.donationId);

		expect(payments).toHaveLength(2);
		expect(payments.map((p) => p.sequenceNumber)).toEqual([1, 2]);
	});

	// ========================================================
	// 2. NOTIFICATION RÉPÉTÉE
	// ========================================================

	it('returns the existing payment for a repeated Mollie ID', async () => {
		const molliePaymentId = newMolliePaymentId();

		const data = recurringPaymentData(fixture, molliePaymentId);

		const first = await createRecurringDonationPayment(data);
		const second = await createRecurringDonationPayment(data);

		expect(second.id).toBe(first.id);
		expect(second.sequenceNumber).toBe(2);

		const payments = await getDonationPayments(fixture.donationId);

		expect(payments).toHaveLength(2);

		expect(payments.filter((payment) => payment.molliePaymentId === molliePaymentId)).toHaveLength(
			1
		);
	});

	// ========================================================
	// 3. NOTIFICATIONS CONCURRENTES
	// ========================================================

	it('creates only one payment for concurrent identical notifications', async () => {
		const molliePaymentId = newMolliePaymentId();

		const data = recurringPaymentData(fixture, molliePaymentId);

		const [first, second] = await Promise.all([
			createRecurringDonationPayment(data),
			createRecurringDonationPayment(data)
		]);

		expect(first.id).toBe(second.id);
		expect(first.sequenceNumber).toBe(2);
		expect(second.sequenceNumber).toBe(2);

		const payments = await getDonationPayments(fixture.donationId);

		expect(payments).toHaveLength(2);

		expect(payments.filter((payment) => payment.molliePaymentId === molliePaymentId)).toHaveLength(
			1
		);
	});

	// ========================================================
	// 4. PAIEMENTS DISTINCTS CONCURRENTS
	// ========================================================

	it('assigns consecutive sequence numbers to concurrent distinct payments', async () => {
		const firstMollieId = newMolliePaymentId();
		const secondMollieId = newMolliePaymentId();

		const [first, second] = await Promise.all([
			createRecurringDonationPayment(recurringPaymentData(fixture, firstMollieId)),
			createRecurringDonationPayment(recurringPaymentData(fixture, secondMollieId))
		]);

		expect(first.id).not.toBe(second.id);

		const payments = await getDonationPayments(fixture.donationId);

		expect(payments).toHaveLength(3);

		expect(payments.map((payment) => payment.sequenceNumber)).toEqual([1, 2, 3]);

		expect(new Set(payments.map((payment) => payment.molliePaymentId)).size).toBe(3);
	});
});
