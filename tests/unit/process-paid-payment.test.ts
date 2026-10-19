import { describe, it, expect, vi, beforeEach } from 'vitest';

import { processPaidDonationPayment } from '$lib/server/donations/process-paid-payment';

import {
	completeOneOffDonation,
	completeRecurringDonation,
	getDonationById
} from '$lib/server/donations/donations';

import { getDonorById } from '$lib/server/donations/donors';

import {
	countPaidDonationPayments,
	getFirstPaidDonationPayment
} from '$lib/server/donations/payments';

import { getUsableMollieCustomerMandate } from '$lib/server/mollie/customers';

import {
	createMollieSubscription,
	findExistingMollieSubscription
} from '$lib/server/mollie/subscriptions';

import {
	reserveSubscriptionCreation,
	markSubscriptionReconciliationRequired,
	activateReservedSubscription,
	recoverExistingSubscription
} from '$lib/server/donations/subscription-reservation';

import {
	donationId,
	customerId,
	donor,
	firstPayment,
	mandate,
	reservation,
	makeDonation,
	makeExistingSubscription,
	makeCreatedSubscription
} from '../fixtures/process-paid-payment';

// ============================================================

// MOCKS

// ============================================================

vi.mock('$lib/server/donations/donations', () => ({
	completeOneOffDonation: vi.fn(),

	completeRecurringDonation: vi.fn(),

	getDonationById: vi.fn()
}));

vi.mock('$lib/server/donations/donors', () => ({
	getDonorById: vi.fn()
}));

vi.mock('$lib/server/donations/payments', () => ({
	countPaidDonationPayments: vi.fn(),

	getFirstPaidDonationPayment: vi.fn()
}));

vi.mock('$lib/server/mollie/customers', () => ({
	getUsableMollieCustomerMandate: vi.fn()
}));

vi.mock('$lib/server/mollie/subscriptions', () => ({
	createMollieSubscription: vi.fn(),

	findExistingMollieSubscription: vi.fn()
}));

vi.mock('$lib/server/donations/subscription-reservation', () => ({
	reserveSubscriptionCreation: vi.fn(),

	markSubscriptionReconciliationRequired: vi.fn(),

	activateReservedSubscription: vi.fn(),

	recoverExistingSubscription: vi.fn()
}));

function mockDonation(overrides: Partial<ReturnType<typeof makeDonation>> = {}) {
	vi.mocked(getDonationById).mockResolvedValue(makeDonation(overrides));
}

function mockExistingSubscription(
	status: Parameters<typeof makeExistingSubscription>[0],

	id?: string
) {
	vi.mocked(findExistingMollieSubscription).mockResolvedValue(makeExistingSubscription(status, id));
}

function mockCreatedSubscription(
	status: Parameters<typeof makeCreatedSubscription>[0] = 'active',

	id?: string
) {
	vi.mocked(createMollieSubscription).mockResolvedValue(makeCreatedSubscription(status, id));
}

// ============================================================

// TESTS

// ============================================================

describe('processPaidDonationPayment', () => {
	beforeEach(() => {
		vi.resetAllMocks();

		mockDonation();

		vi.mocked(getDonorById).mockResolvedValue(donor as Awaited<ReturnType<typeof getDonorById>>);

		vi.mocked(getFirstPaidDonationPayment).mockResolvedValue(firstPayment);

		vi.mocked(getUsableMollieCustomerMandate).mockResolvedValue(
			mandate as Awaited<ReturnType<typeof getUsableMollieCustomerMandate>>
		);

		vi.mocked(countPaidDonationPayments).mockResolvedValue(1);

		vi.mocked(findExistingMollieSubscription).mockResolvedValue(null);

		mockCreatedSubscription();

		vi.mocked(reserveSubscriptionCreation).mockResolvedValue(reservation);

		vi.mocked(markSubscriptionReconciliationRequired).mockResolvedValue(true);

		vi.mocked(activateReservedSubscription).mockResolvedValue(true);

		vi.mocked(recoverExistingSubscription).mockResolvedValue(true);
	});

	// ========================================================

	// 1. CRÉATION ET ACTIVATION

	// ========================================================

	it('creates and activates a subscription after the first payment', async () => {
		await processPaidDonationPayment(donationId, 1);

		expect(reserveSubscriptionCreation).toHaveBeenCalledWith(donationId);

		expect(findExistingMollieSubscription).toHaveBeenCalledWith({
			customerId,

			donationId
		});

		expect(createMollieSubscription).toHaveBeenCalledWith({
			customerId,

			donationId,

			amount: 2500,

			frequency: 'monthly',

			paymentCount: null,

			mandateId: mandate.id,

			firstPaymentDate: firstPayment.paidAt
		});

		expect(activateReservedSubscription).toHaveBeenCalledWith(
			reservation,
			'sub_test123456',
			'active'
		);

		expect(markSubscriptionReconciliationRequired).not.toHaveBeenCalled();
	});

	// ========================================================

	// 2. IDEMPOTENCE

	// ========================================================

	it('does not recreate an existing subscription', async () => {
		mockDonation({
			mollieSubscriptionId: 'sub_existing123',

			subscriptionCreationStatus: 'activated'
		});

		await processPaidDonationPayment(donationId, 1);

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(reserveSubscriptionCreation).not.toHaveBeenCalled();

		expect(activateReservedSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 3. CLIENT MOLLIE ABSENT

	// ========================================================

	it('rejects a missing Mollie customer ID', async () => {
		vi.mocked(getDonorById).mockResolvedValue({
			...donor,

			mollieCustomerId: null
		} as Awaited<ReturnType<typeof getDonorById>>);

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'Mollie customer ID is missing'
		);

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(reserveSubscriptionCreation).not.toHaveBeenCalled();
	});

	// ========================================================

	// 4. MANDAT ABSENT

	// ========================================================

	it('rejects a missing usable mandate', async () => {
		vi.mocked(getUsableMollieCustomerMandate).mockResolvedValue(null);

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'No usable Mollie mandate found'
		);

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(reserveSubscriptionCreation).not.toHaveBeenCalled();
	});

	// ========================================================

	// 5. FRÉQUENCE ABSENTE

	// ========================================================

	it('rejects a missing recurring frequency', async () => {
		mockDonation({
			frequency: null as never
		});

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'Recurring donation frequency is missing'
		);

		expect(createMollieSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 6. NOMBRE DE PAIEMENTS INVALIDE

	// ========================================================

	it('rejects an invalid fixed payment count', async () => {
		mockDonation({
			duration: 'fixed' as never,

			paymentCount: 1
		});

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'Invalid payment count'
		);

		expect(createMollieSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 7. PREMIER PAIEMENT INTROUVABLE

	// ========================================================

	it('rejects a missing first paid payment', async () => {
		vi.mocked(getFirstPaidDonationPayment).mockResolvedValue(null);

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'First paid payment or payment date not found'
		);

		expect(createMollieSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 8. ÉCHEC DE CRÉATION MOLLIE

	// ========================================================

	it('marks reconciliation required if Mollie creation fails', async () => {
		vi.mocked(createMollieSubscription).mockRejectedValue(new Error('Mollie API unavailable'));

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'Mollie API unavailable'
		);

		expect(activateReservedSubscription).not.toHaveBeenCalled();

		expect(markSubscriptionReconciliationRequired).toHaveBeenCalledWith(reservation);
	});

	// ========================================================

	// 9. ÉCHEC D'ACTIVATION POSTGRESQL

	// ========================================================

	it('marks reconciliation required after an activation failure', async () => {
		vi.mocked(activateReservedSubscription).mockRejectedValue(new Error('Database unavailable'));

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow('Database unavailable');

		expect(createMollieSubscription).toHaveBeenCalledOnce();

		expect(activateReservedSubscription).toHaveBeenCalledWith(
			reservation,
			'sub_test123456',
			'active'
		);

		expect(markSubscriptionReconciliationRequired).toHaveBeenCalledWith(reservation);
	});

	// ========================================================

	// 10. DON PONCTUEL

	// ========================================================

	it('completes a one-off donation', async () => {
		mockDonation({
			type: 'one-off',

			status: 'pending'
		});

		await processPaidDonationPayment(donationId, 1);

		expect(completeOneOffDonation).toHaveBeenCalledWith(donationId);

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(reserveSubscriptionCreation).not.toHaveBeenCalled();
	});

	// ========================================================

	// 11. DURÉE ILLIMITÉE

	// ========================================================

	it('does not complete an unlimited donation on later payments', async () => {
		mockDonation({
			duration: 'unlimited',

			status: 'active',

			subscriptionCreationStatus: 'activated',

			mollieSubscriptionId: 'sub_existing123'
		});

		await processPaidDonationPayment(donationId, 2);

		expect(completeRecurringDonation).not.toHaveBeenCalled();

		expect(createMollieSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 12. DERNIÈRE ÉCHÉANCE

	// ========================================================

	it('completes a fixed donation after its final paid payment', async () => {
		mockDonation({
			duration: 'fixed' as never,

			paymentCount: 3,

			status: 'active',

			subscriptionCreationStatus: 'activated',

			mollieSubscriptionId: 'sub_existing123'
		});

		vi.mocked(countPaidDonationPayments).mockResolvedValue(3);

		await processPaidDonationPayment(donationId, 3);

		expect(countPaidDonationPayments).toHaveBeenCalledWith(donationId);

		expect(completeRecurringDonation).toHaveBeenCalledWith(donationId);
	});

	// ========================================================

	// 13. ABONNEMENT MOLLIE EXISTANT

	// ========================================================

	it('activates an existing active Mollie subscription using the reservation', async () => {
		mockExistingSubscription('active');

		await processPaidDonationPayment(donationId, 1);

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(reserveSubscriptionCreation).toHaveBeenCalledWith(donationId);

		expect(activateReservedSubscription).toHaveBeenCalledWith(
			reservation,
			'sub_existing123',
			'active'
		);
	});

	// ========================================================

	// 14. ABONNEMENT PENDING

	// ========================================================

	it('registers an existing pending subscription without recreating it', async () => {
		mockExistingSubscription('pending', 'sub_pending123');

		await processPaidDonationPayment(donationId, 1);

		expect(createMollieSubscription).not.toHaveBeenCalled();
		expect(activateReservedSubscription).toHaveBeenCalledWith(
			reservation,
			'sub_pending123',
			'pending'
		);
		expect(markSubscriptionReconciliationRequired).not.toHaveBeenCalled();
	});

	it('registers a newly created pending subscription', async () => {
		mockCreatedSubscription('pending', 'sub_new_pending');

		await processPaidDonationPayment(donationId, 1);

		expect(createMollieSubscription).toHaveBeenCalledOnce();
		expect(activateReservedSubscription).toHaveBeenCalledWith(
			reservation,
			'sub_new_pending',
			'pending'
		);
		expect(markSubscriptionReconciliationRequired).not.toHaveBeenCalled();
	});

	it('recovers an existing pending subscription without creating another', async () => {
		mockDonation({ subscriptionCreationStatus: 'reconciliation_required' });
		mockExistingSubscription('pending', 'sub_recovered_pending');

		await processPaidDonationPayment(donationId, 1);

		expect(recoverExistingSubscription).toHaveBeenCalledWith(
			donationId,
			'sub_recovered_pending',
			'pending'
		);
		expect(createMollieSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 15. ABONNEMENTS NON RÉCUPÉRABLES

	// ========================================================

	it.each(['canceled', 'completed', 'suspended'] as const)(
		'does not recreate a %s Mollie subscription',

		async (status) => {
			mockExistingSubscription(status);

			await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
				`has status ${status}; automatic recovery is not allowed`
			);

			expect(createMollieSubscription).not.toHaveBeenCalled();

			expect(activateReservedSubscription).not.toHaveBeenCalled();

			expect(markSubscriptionReconciliationRequired).toHaveBeenCalledWith(reservation);
		}
	);

	// ========================================================

	// 16. RÉSERVATION REFUSÉE

	// ========================================================

	it('does not call Mollie when reservation is refused', async () => {
		vi.mocked(reserveSubscriptionCreation).mockResolvedValue(null);

		await processPaidDonationPayment(donationId, 1);

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(findExistingMollieSubscription).not.toHaveBeenCalled();

		expect(activateReservedSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 17. RÉSERVATION DÉJÀ DÉTENUE

	// ========================================================

	it('does not create a subscription when another process holds the reservation', async () => {
		mockDonation({
			subscriptionCreationStatus: 'reserved',

			subscriptionCreationToken: reservation.token,

			subscriptionCreationReservedAt: new Date()
		});

		await processPaidDonationPayment(donationId, 1);

		expect(reserveSubscriptionCreation).not.toHaveBeenCalled();

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(activateReservedSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 18. RÉCUPÉRATION APRÈS ÉCHEC

	// ========================================================

	it('recovers an active subscription when reconciliation is required', async () => {
		mockDonation({
			subscriptionCreationStatus: 'reconciliation_required'
		});

		mockExistingSubscription('active', 'sub_recovered123');

		await processPaidDonationPayment(donationId, 1);

		expect(findExistingMollieSubscription).toHaveBeenCalledWith({
			customerId,

			donationId
		});

		expect(recoverExistingSubscription).toHaveBeenCalledWith(
			donationId,
			'sub_recovered123',
			'active'
		);

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(reserveSubscriptionCreation).not.toHaveBeenCalled();
	});

	// ========================================================

	// 19. RÉCONCILIATION SANS ABONNEMENT

	// ========================================================

	it('does not create a subscription when reconciliation finds nothing', async () => {
		mockDonation({
			subscriptionCreationStatus: 'reconciliation_required'
		});

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'no Mollie subscription found'
		);

		expect(createMollieSubscription).not.toHaveBeenCalled();

		expect(recoverExistingSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 20. ÉCHEC DE RÉCUPÉRATION POSTGRESQL

	// ========================================================

	it('propagates a recovery failure without creating a subscription', async () => {
		mockDonation({
			subscriptionCreationStatus: 'reconciliation_required'
		});

		mockExistingSubscription('active');

		vi.mocked(recoverExistingSubscription).mockResolvedValue(false);

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'Unable to recover Mollie subscription'
		);

		expect(createMollieSubscription).not.toHaveBeenCalled();
	});

	// ========================================================

	// 21. ACTIVATION CONDITIONNELLE REFUSÉE

	// ========================================================

	it('requests reconciliation when conditional activation is refused', async () => {
		vi.mocked(activateReservedSubscription).mockResolvedValue(false);

		await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
			'Unable to register Mollie subscription'
		);

		expect(markSubscriptionReconciliationRequired).toHaveBeenCalledWith(reservation);
	});

	// ========================================================

	// 22. ÉCHEC DU MARQUAGE DE RÉCONCILIATION

	// ========================================================

	it('preserves the original Mollie error if reconciliation marking fails', async () => {
		vi.mocked(createMollieSubscription).mockRejectedValue(new Error('Mollie API unavailable'));

		vi.mocked(markSubscriptionReconciliationRequired).mockRejectedValue(
			new Error('Database unavailable')
		);

		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		try {
			await expect(processPaidDonationPayment(donationId, 1)).rejects.toThrow(
				'Mollie API unavailable'
			);

			expect(markSubscriptionReconciliationRequired).toHaveBeenCalledWith(reservation);
		} finally {
			consoleError.mockRestore();
		}
	});
});
