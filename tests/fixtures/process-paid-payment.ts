import type { donations } from '$lib/server/db/schema';

import type {
	createMollieSubscription,
	findExistingMollieSubscription
} from '$lib/server/mollie/subscriptions';

export const donationId = '22222222-2222-4222-8222-222222222222';

export const donorId = '11111111-1111-4111-8111-111111111111';

export const customerId = 'cst_test123456';

export const reservation = {
	donationId,
	token: '44444444-4444-4444-8444-444444444444'
};

export type Donation = typeof donations.$inferSelect;

export const recurringDonation = {
	id: donationId,
	donorId,
	type: 'recurring',
	status: 'pending',
	amount: 2500,
	frequency: 'monthly',
	duration: 'unlimited',
	paymentCount: null,
	mollieSubscriptionId: null,
	subscriptionCreationStatus: 'idle',
	subscriptionCreationToken: null,
	subscriptionCreationReservedAt: null
} satisfies Partial<Donation>;

export const donor = {
	id: donorId,
	mollieCustomerId: customerId
};

export const firstPayment = {
	id: '33333333-3333-4333-8333-333333333333',
	paidAt: new Date('2026-01-15T10:00:00.000Z')
};

export const mandate = {
	id: 'mdt_test123456',
	status: 'valid'
};

export type ListedSubscription = NonNullable<
	Awaited<ReturnType<typeof findExistingMollieSubscription>>
>;

export type CreatedSubscription = Awaited<ReturnType<typeof createMollieSubscription>>;

export function makeDonation(overrides: Partial<Donation> = {}): Donation {
	return {
		...recurringDonation,
		...overrides
	} as Donation;
}

export function makeExistingSubscription(
	status: ListedSubscription['status'],
	id = 'sub_existing123'
): ListedSubscription {
	return {
		id,
		customerId,
		status
	} as ListedSubscription;
}

export function makeCreatedSubscription(
	status: CreatedSubscription['status'] = 'active',
	id = 'sub_test123456'
): CreatedSubscription {
	return {
		id,
		status
	} as CreatedSubscription;
}
