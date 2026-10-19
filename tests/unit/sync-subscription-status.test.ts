import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const state = {
		donation: null as Record<string, unknown> | null,
		donor: null as Record<string, unknown> | null,
		subscription: null as Record<string, unknown> | null,
		updateValues: null as Record<string, unknown> | null,
		updateCount: 0,
		lockCount: 0
	};

	const getMollieSubscription = vi.fn();

	return { state, getMollieSubscription };
});

vi.mock('$lib/server/mollie/subscriptions', () => ({
	getMollieSubscription: mocks.getMollieSubscription
}));

vi.mock('$lib/server/db', () => {
	const tx = {
		select: vi.fn(() => ({
			from: vi.fn(() => {
				// La requête du don utilise FOR UPDATE.
				// Celle du donateur n'utilise pas de verrou.
				return {
					where: vi.fn(() => ({
						for: vi.fn(() => {
							mocks.state.lockCount++;

							return {
								limit: vi.fn(async () => (mocks.state.donation ? [mocks.state.donation] : []))
							};
						}),
						limit: vi.fn(async () => (mocks.state.donor ? [mocks.state.donor] : []))
					}))
				};
			})
		})),
		update: vi.fn(() => ({
			set: vi.fn((values: Record<string, unknown>) => {
				mocks.state.updateValues = values;
				mocks.state.updateCount++;

				return {
					where: vi.fn(async () => [])
				};
			})
		}))
	};

	return {
		db: {
			transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx))
		}
	};
});

import { syncMollieSubscription } from '$lib/server/donations/sync-subscription-status';

const donationId = '11111111-1111-4111-8111-111111111111';
const donorId = '22222222-2222-4222-8222-222222222222';
const subscriptionId = 'sub_test123';
const customerId = 'cst_test123';

type DonationStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'failed';

type MollieStatus = 'pending' | 'active' | 'suspended' | 'canceled' | 'completed';

function setDonation(status: DonationStatus, mollieSubscriptionStatus: MollieStatus | null = null) {
	mocks.state.donation = {
		id: donationId,
		donorId,
		type: 'recurring',
		status,
		subscriptionCreationStatus: 'activated',
		mollieSubscriptionId: subscriptionId,
		mollieSubscriptionStatus
	};
}

function setSubscription(status: MollieStatus, metadata: unknown = { donationId }) {
	mocks.getMollieSubscription.mockResolvedValue({
		id: subscriptionId,
		status,
		metadata
	});
}

describe('syncMollieSubscription', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.state.donation = null;
		mocks.state.donor = {
			mollieCustomerId: customerId
		};
		mocks.state.updateValues = null;
		mocks.state.updateCount = 0;
		mocks.state.lockCount = 0;

		setDonation('pending');
		setSubscription('pending');
	});

	it('refuse un identifiant vide', async () => {
		await expect(syncMollieSubscription(' ')).rejects.toThrow('Mollie subscription ID is required');

		expect(mocks.getMollieSubscription).not.toHaveBeenCalled();
	});

	it('retourne not_found si aucun don ne correspond', async () => {
		mocks.state.donation = null;

		await expect(syncMollieSubscription(subscriptionId)).resolves.toBe('not_found');

		expect(mocks.getMollieSubscription).not.toHaveBeenCalled();
	});

	it('verrouille le don avant de consulter Mollie', async () => {
		await syncMollieSubscription(subscriptionId);

		expect(mocks.state.lockCount).toBe(1);
		expect(mocks.getMollieSubscription).toHaveBeenCalledWith({
			customerId,
			subscriptionId
		});
	});

	it('active un don lorsque Mollie retourne active', async () => {
		setSubscription('active');

		const result = await syncMollieSubscription(subscriptionId);

		expect(result).toBe('updated');

		expect(mocks.state.updateValues).toMatchObject({
			status: 'active',
			mollieSubscriptionStatus: 'active'
		});

		expect(mocks.state.updateValues?.mollieSubscriptionSyncedAt).toBeInstanceOf(Date);
	});

	it('ne fait pas régresser un don actif vers pending', async () => {
		setDonation('active', 'active');
		setSubscription('pending');

		const result = await syncMollieSubscription(subscriptionId);

		expect(result).toBe('updated');

		expect(mocks.state.updateValues).toMatchObject({
			status: 'active',
			mollieSubscriptionStatus: 'pending'
		});
	});

	it('conserve le statut métier lors d’une suspension', async () => {
		setDonation('active', 'active');
		setSubscription('suspended');

		const result = await syncMollieSubscription(subscriptionId);

		expect(result).toBe('suspended');

		expect(mocks.state.updateValues).toMatchObject({
			status: 'active',
			mollieSubscriptionStatus: 'suspended'
		});
	});

	it('réactive techniquement un abonnement suspendu', async () => {
		setDonation('active', 'suspended');
		setSubscription('active');

		const result = await syncMollieSubscription(subscriptionId);

		expect(result).toBe('updated');

		expect(mocks.state.updateValues).toMatchObject({
			status: 'active',
			mollieSubscriptionStatus: 'active'
		});
	});

	it('annule un don lorsque Mollie retourne canceled', async () => {
		setDonation('active', 'active');
		setSubscription('canceled');

		const result = await syncMollieSubscription(subscriptionId);

		expect(result).toBe('updated');

		expect(mocks.state.updateValues).toMatchObject({
			status: 'cancelled',
			mollieSubscriptionStatus: 'canceled'
		});

		expect(mocks.state.updateValues?.cancelledAt).toBeInstanceOf(Date);
	});

	it('termine un don lorsque Mollie retourne completed', async () => {
		setDonation('active', 'active');
		setSubscription('completed');

		const result = await syncMollieSubscription(subscriptionId);

		expect(result).toBe('updated');

		expect(mocks.state.updateValues).toMatchObject({
			status: 'completed',
			mollieSubscriptionStatus: 'completed'
		});

		expect(mocks.state.updateValues?.completedAt).toBeInstanceOf(Date);
	});

	it.each(['cancelled', 'completed', 'failed'] as const)(
		'ne réactive pas un don terminal %s',
		async (status) => {
			setDonation(status);
			setSubscription('active');

			const result = await syncMollieSubscription(subscriptionId);

			expect(result).toBe('terminal');
			expect(mocks.state.updateValues?.status).toBe(status);
		}
	);

	it('retourne unchanged lorsque le statut est identique', async () => {
		setDonation('active', 'active');
		setSubscription('active');

		const result = await syncMollieSubscription(subscriptionId);

		expect(result).toBe('unchanged');
	});

	it('refuse un abonnement appartenant à un autre don', async () => {
		setSubscription('active', {
			donationId: '33333333-3333-4333-8333-333333333333'
		});

		await expect(syncMollieSubscription(subscriptionId)).rejects.toThrow(
			'belongs to another donation'
		);

		expect(mocks.state.updateCount).toBe(0);
	});

	it('refuse un identifiant d’abonnement incohérent', async () => {
		mocks.getMollieSubscription.mockResolvedValue({
			id: 'sub_other',
			status: 'active',
			metadata: { donationId }
		});

		await expect(syncMollieSubscription(subscriptionId)).rejects.toThrow(
			'Mollie subscription ID mismatch'
		);

		expect(mocks.state.updateCount).toBe(0);
	});

	it('refuse un statut Mollie inconnu', async () => {
		mocks.getMollieSubscription.mockResolvedValue({
			id: subscriptionId,
			status: 'unknown_status',
			metadata: { donationId }
		});

		await expect(syncMollieSubscription(subscriptionId)).rejects.toThrow(
			'Unsupported Mollie subscription status'
		);

		expect(mocks.state.updateCount).toBe(0);
	});

	it('propage une erreur Mollie sans modifier le don', async () => {
		mocks.getMollieSubscription.mockRejectedValue(new Error('Mollie API unavailable'));

		await expect(syncMollieSubscription(subscriptionId)).rejects.toThrow('Mollie API unavailable');

		expect(mocks.state.updateCount).toBe(0);
	});

	it('refuse un donateur sans client Mollie', async () => {
		mocks.state.donor = {
			mollieCustomerId: null
		};

		await expect(syncMollieSubscription(subscriptionId)).rejects.toThrow(
			'Mollie customer ID is missing'
		);

		expect(mocks.getMollieSubscription).not.toHaveBeenCalled();
	});
});
