import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mollie } from '$lib/server/mollie/client';

import {
	createMollieSubscription,
	type CreateMollieSubscriptionData
} from '$lib/server/mollie/subscriptions';

// ============================================================
// MOCKS
// ============================================================

vi.mock('$lib/server/mollie/client', () => ({
	mollie: {
		subscriptions: {
			create: vi.fn()
		}
	}
}));

vi.mock('$lib/server/mollie/webhook-url', () => ({
	getMollieWebhookUrl: vi.fn(() => 'https://example.test/api/mollie/webhook')
}));

// ============================================================
// FIXTURES
// ============================================================

const donationId = '22222222-2222-4222-8222-222222222222';

const baseData: CreateMollieSubscriptionData = {
	customerId: 'cst_test123456',
	donationId,
	amount: 2500,
	frequency: 'monthly',
	paymentCount: null,
	mandateId: 'mdt_test123456',
	firstPaymentDate: new Date('2026-01-15T10:00:00.000Z')
};

function getSubscriptionRequest() {
	const create = vi.mocked(mollie.subscriptions.create);

	expect(create).toHaveBeenCalledOnce();

	const request = create.mock.calls[0][0];

	if (!request.subscriptionRequest) {
		throw new Error('Mollie subscriptionRequest is missing');
	}

	return {
		...request,
		subscriptionRequest: request.subscriptionRequest
	};
}

// ============================================================
// TESTS
// ============================================================

describe('createMollieSubscription', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('creates a monthly subscription', async () => {
		await createMollieSubscription(baseData);

		const request = getSubscriptionRequest();

		expect(request.customerId).toBe(baseData.customerId);
		expect(request.idempotencyKey).toBe(donationId);

		expect(request.subscriptionRequest).toMatchObject({
			amount: {
				currency: 'EUR',
				value: '25.00'
			},
			interval: '1 month',
			startDate: '2026-02-15',
			mandateId: 'mdt_test123456',
			webhookUrl: 'https://example.test/api/mollie/webhook'
		});
	});

	it('creates a quarterly subscription', async () => {
		await createMollieSubscription({
			...baseData,
			frequency: 'quarterly'
		});

		const request = getSubscriptionRequest();

		expect(request.subscriptionRequest.interval).toBe('3 months');
		expect(request.subscriptionRequest.startDate).toBe('2026-04-15');
	});

	it('subtracts the first paid installment from a fixed duration', async () => {
		await createMollieSubscription({
			...baseData,
			paymentCount: 6
		});

		const request = getSubscriptionRequest();

		expect(request.subscriptionRequest.times).toBe(5);
	});

	it('omits times for an unlimited subscription', async () => {
		await createMollieSubscription({
			...baseData,
			paymentCount: null
		});

		const request = getSubscriptionRequest();

		expect(request.subscriptionRequest).not.toHaveProperty('times');
	});

	it('handles the last day of February', async () => {
		await createMollieSubscription({
			...baseData,
			firstPaymentDate: new Date('2026-01-31T10:00:00.000Z')
		});

		const request = getSubscriptionRequest();

		expect(request.subscriptionRequest.startDate).toBe('2026-02-28');
	});

	it('handles leap years', async () => {
		await createMollieSubscription({
			...baseData,
			firstPaymentDate: new Date('2028-01-31T10:00:00.000Z')
		});

		const request = getSubscriptionRequest();

		expect(request.subscriptionRequest.startDate).toBe('2028-02-29');
	});

	it('rejects an invalid payment count', async () => {
		await expect(
			createMollieSubscription({
				...baseData,
				paymentCount: 1
			})
		).rejects.toThrow('Recurring donation must have at least one remaining payment');

		expect(mollie.subscriptions.create).not.toHaveBeenCalled();
	});

	it('rejects an invalid first payment date', async () => {
		await expect(
			createMollieSubscription({
				...baseData,
				firstPaymentDate: new Date('invalid')
			})
		).rejects.toThrow('Invalid first payment date');

		expect(mollie.subscriptions.create).not.toHaveBeenCalled();
	});

	it('uses the donation ID as idempotency key', async () => {
		await createMollieSubscription(baseData);

		const request = getSubscriptionRequest();

		expect(request.idempotencyKey).toBe(donationId);
	});

	it('passes the Mollie mandate ID when provided', async () => {
		await createMollieSubscription(baseData);

		const request = getSubscriptionRequest();

		expect(request.subscriptionRequest.mandateId).toBe('mdt_test123456');
	});

	it('omits the mandate ID when not provided', async () => {
		await createMollieSubscription({
			...baseData,
			mandateId: undefined
		});

		const request = getSubscriptionRequest();

		expect(request.subscriptionRequest).not.toHaveProperty('mandateId');
	});

	it('includes the donation ID in subscription metadata', async () => {
		await createMollieSubscription(baseData);

		const request = getSubscriptionRequest();

		expect(request.subscriptionRequest.metadata).toEqual({
			donationId
		});
	});
});
