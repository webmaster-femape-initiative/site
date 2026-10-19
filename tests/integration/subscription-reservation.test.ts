import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';

import { donations } from '$lib/server/db/schema';

import {
	reserveSubscriptionCreation,
	markSubscriptionReconciliationRequired,
	activateReservedSubscription,
	recoverExistingSubscription,
	reconcileStaleSubscriptionReservation,
	SUBSCRIPTION_RESERVATION_TIMEOUT_MS
} from '$lib/server/donations/subscription-reservation';

import {
	createRecurringDonationFixture,
	type RecurringDonationFixture
} from '../fixtures/recurring-donations';

// ============================================================

// HELPERS

// ============================================================

async function getDonation(donationId: string) {
	const [donation] = await db.select().from(donations).where(eq(donations.id, donationId)).limit(1);

	if (!donation) {
		throw new Error(`Donation ${donationId} not found`);
	}

	return donation;
}

// ============================================================

// TESTS

// ============================================================

describe('Recurring subscription creation reservation', () => {
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

	// 1. PREMIÈRE RÉSERVATION

	// ========================================================

	it('reserves subscription creation for an idle donation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		expect(reservation?.donationId).toBe(fixture.donationId);

		expect(reservation?.token).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
		);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reserved');

		expect(donation.subscriptionCreationToken).toBe(reservation?.token);

		expect(donation.subscriptionCreationReservedAt).toBeInstanceOf(Date);
	});

	// ========================================================

	// 2. RÉSERVATIONS CONCURRENTES

	// ========================================================

	it('allows only one concurrent reservation', async () => {
		const [first, second] = await Promise.all([
			reserveSubscriptionCreation(fixture.donationId),

			reserveSubscriptionCreation(fixture.donationId)
		]);

		const successful = [first, second].filter((reservation) => reservation !== null);

		expect(successful).toHaveLength(1);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reserved');

		expect(donation.subscriptionCreationToken).toBe(successful[0]?.token);
	});

	// ========================================================

	// 3. RÉSERVATION DÉJÀ DÉTENUE

	// ========================================================

	it('rejects another reservation while one is held', async () => {
		const first = await reserveSubscriptionCreation(fixture.donationId);

		expect(first).not.toBeNull();

		const second = await reserveSubscriptionCreation(fixture.donationId);

		expect(second).toBeNull();
	});

	// ========================================================

	// 4. PROTECTION PAR JETON

	// ========================================================

	it('rejects reconciliation with an incorrect token', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		const updated = await markSubscriptionReconciliationRequired({
			donationId: fixture.donationId,

			token: crypto.randomUUID()
		});

		expect(updated).toBe(false);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reserved');

		expect(donation.subscriptionCreationToken).toBe(reservation.token);
	});

	// ========================================================

	// 5. PASSAGE EN RAPPROCHEMENT

	// ========================================================

	it('marks a reserved subscription for reconciliation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		const updated = await markSubscriptionReconciliationRequired(reservation);

		expect(updated).toBe(true);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reconciliation_required');

		expect(donation.subscriptionCreationToken).toBeNull();

		expect(donation.subscriptionCreationReservedAt).toBeNull();
	});

	// ========================================================

	// 6. PAS DE NOUVELLE RÉSERVATION APRÈS RAPPROCHEMENT

	// ========================================================

	it('does not reserve a donation requiring reconciliation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		await markSubscriptionReconciliationRequired(reservation);

		const second = await reserveSubscriptionCreation(fixture.donationId);

		expect(second).toBeNull();

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reconciliation_required');
	});

	// ========================================================

	// 7. ABONNEMENT DÉJÀ ENREGISTRÉ

	// ========================================================

	it('does not reserve a donation with an existing Mollie subscription', async () => {
		await db

			.update(donations)

			.set({
				mollieSubscriptionId: 'sub_existing123',

				subscriptionCreationStatus: 'activated'
			})

			.where(eq(donations.id, fixture.donationId));

		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).toBeNull();

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('activated');

		expect(donation.mollieSubscriptionId).toBe('sub_existing123');
	});

	// ========================================================

	// 8. ACTIVATION RÉUSSIE

	// ========================================================

	it('activates a subscription with a valid reservation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		const activated = await activateReservedSubscription(reservation, 'sub_test_active', 'active');

		expect(activated).toBe(true);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('activated');

		expect(donation.mollieSubscriptionId).toBe('sub_test_active');

		expect(donation.status).toBe('active');

		expect(donation.subscriptionCreationToken).toBeNull();

		expect(donation.subscriptionCreationReservedAt).toBeNull();
	});

	// ========================================================

	// 9. JETON INCORRECT

	// ========================================================

	it('rejects activation with an incorrect token', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		const activated = await activateReservedSubscription(
			{
				donationId: fixture.donationId,

				token: crypto.randomUUID()
			},

			'sub_test_wrong',
			'active'
		);

		expect(activated).toBe(false);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reserved');

		expect(donation.mollieSubscriptionId).toBeNull();

		expect(donation.subscriptionCreationToken).toBe(reservation.token);
	});

	// ========================================================

	// 10. ACTIVATION UNIQUE

	// ========================================================

	it('does not activate the same reservation twice', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		const first = await activateReservedSubscription(reservation, 'sub_test_first', 'active');

		const second = await activateReservedSubscription(reservation, 'sub_test_second', 'active');

		expect(first).toBe(true);

		expect(second).toBe(false);

		const donation = await getDonation(fixture.donationId);

		expect(donation.mollieSubscriptionId).toBe('sub_test_first');

		expect(donation.subscriptionCreationStatus).toBe('activated');
	});

	// ========================================================

	// 11. ACTIVATIONS CONCURRENTES

	// ========================================================

	it('allows only one concurrent activation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		const [first, second] = await Promise.all([
			activateReservedSubscription(reservation, 'sub_test_concurrent_a', 'active'),

			activateReservedSubscription(reservation, 'sub_test_concurrent_b', 'active')
		]);

		expect([first, second].filter(Boolean)).toHaveLength(1);

		const donation = await getDonation(fixture.donationId);

		const expectedId = first ? 'sub_test_concurrent_a' : 'sub_test_concurrent_b';

		expect(donation.mollieSubscriptionId).toBe(expectedId);

		expect(donation.subscriptionCreationStatus).toBe('activated');

		expect(donation.subscriptionCreationToken).toBeNull();
	});

	// ========================================================

	// 12. RÉSERVATION DÉJÀ LIBÉRÉE

	// ========================================================

	it('rejects activation after reconciliation was requested', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		const reconciled = await markSubscriptionReconciliationRequired(reservation);

		expect(reconciled).toBe(true);

		const activated = await activateReservedSubscription(reservation, 'sub_test_late', 'active');

		expect(activated).toBe(false);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reconciliation_required');

		expect(donation.mollieSubscriptionId).toBeNull();
	});

	// ========================================================

	// 13. IDENTIFIANT MOLLIE INVALIDE

	// ========================================================

	it('rejects an empty Mollie subscription ID', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		await expect(activateReservedSubscription(reservation, '  ', 'active')).rejects.toThrow(
			'Mollie subscription ID is required'
		);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reserved');

		expect(donation.mollieSubscriptionId).toBeNull();
	});

	// ========================================================

	// 14. RÉCUPÉRATION RÉUSSIE

	// ========================================================

	it('recovers an existing subscription after reconciliation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		await markSubscriptionReconciliationRequired(reservation);

		const recovered = await recoverExistingSubscription(
			fixture.donationId,
			'sub_recovered123',
			'active'
		);

		expect(recovered).toBe(true);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('activated');

		expect(donation.mollieSubscriptionId).toBe('sub_recovered123');

		expect(donation.status).toBe('active');

		expect(donation.subscriptionCreationToken).toBeNull();

		expect(donation.subscriptionCreationReservedAt).toBeNull();
	});

	// ========================================================

	// 15. RÉCUPÉRATION SANS RAPPROCHEMENT

	// ========================================================

	it('rejects recovery while a reservation is held', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		expect(reservation).not.toBeNull();

		const recovered = await recoverExistingSubscription(
			fixture.donationId,
			'sub_unauthorized',
			'active'
		);

		expect(recovered).toBe(false);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reserved');

		expect(donation.mollieSubscriptionId).toBeNull();
	});

	// ========================================================

	// 16. RÉCUPÉRATION UNIQUE

	// ========================================================

	it('does not recover the same donation twice', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		await markSubscriptionReconciliationRequired(reservation);

		const first = await recoverExistingSubscription(
			fixture.donationId,
			'sub_first_recovery',
			'active'
		);

		const second = await recoverExistingSubscription(
			fixture.donationId,
			'sub_second_recovery',
			'active'
		);

		expect(first).toBe(true);

		expect(second).toBe(false);

		const donation = await getDonation(fixture.donationId);

		expect(donation.mollieSubscriptionId).toBe('sub_first_recovery');
	});

	// ========================================================

	// 17. RÉCUPÉRATIONS CONCURRENTES

	// ========================================================

	it('allows only one concurrent recovery', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		await markSubscriptionReconciliationRequired(reservation);

		const [first, second] = await Promise.all([
			recoverExistingSubscription(fixture.donationId, 'sub_recovery_a', 'active'),

			recoverExistingSubscription(fixture.donationId, 'sub_recovery_b', 'active')
		]);

		expect([first, second].filter(Boolean)).toHaveLength(1);

		const donation = await getDonation(fixture.donationId);

		expect(donation.mollieSubscriptionId).toBe(first ? 'sub_recovery_a' : 'sub_recovery_b');
	});

	// ========================================================

	// 18. IDENTIFIANT INVALIDE

	// ========================================================

	it('rejects recovery with an empty subscription ID', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);

		if (!reservation) {
			throw new Error('Reservation was not created');
		}

		await markSubscriptionReconciliationRequired(reservation);

		await expect(recoverExistingSubscription(fixture.donationId, ' ', 'active')).rejects.toThrow(
			'Mollie subscription ID is required'
		);

		const donation = await getDonation(fixture.donationId);

		expect(donation.subscriptionCreationStatus).toBe('reconciliation_required');

		expect(donation.mollieSubscriptionId).toBeNull();
	});

	// Enregistrement d'un abonnement pending sans activation métier.
	it('registers a pending subscription without activating the donation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);
		expect(reservation).not.toBeNull();
		if (!reservation) throw new Error('Reservation was not created');

		expect(await activateReservedSubscription(reservation, 'sub_pending', 'pending')).toBe(true);

		const donation = await getDonation(fixture.donationId);
		expect(donation.subscriptionCreationStatus).toBe('activated');
		expect(donation.mollieSubscriptionId).toBe('sub_pending');
		expect(donation.status).toBe('pending');
		expect(donation.subscriptionCreationToken).toBeNull();
		expect(donation.subscriptionCreationReservedAt).toBeNull();
	});

	it('recovers a pending subscription without activating the donation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);
		expect(reservation).not.toBeNull();
		if (!reservation) throw new Error('Reservation was not created');

		expect(await markSubscriptionReconciliationRequired(reservation)).toBe(true);
		expect(
			await recoverExistingSubscription(fixture.donationId, 'sub_pending_recovered', 'pending')
		).toBe(true);

		const donation = await getDonation(fixture.donationId);
		expect(donation.subscriptionCreationStatus).toBe('activated');
		expect(donation.mollieSubscriptionId).toBe('sub_pending_recovered');
		expect(donation.status).toBe('pending');
	});

	it('does not reserve a registered pending subscription again', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);
		if (!reservation) throw new Error('Reservation was not created');
		await activateReservedSubscription(reservation, 'sub_pending', 'pending');

		expect(await reserveSubscriptionCreation(fixture.donationId)).toBeNull();
	});

	async function makeReservationStale() {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);
		if (!reservation) throw new Error('Reservation was not created');
		await db
			.update(donations)
			.set({
				subscriptionCreationReservedAt: new Date(
					Date.now() - SUBSCRIPTION_RESERVATION_TIMEOUT_MS - 60_000
				)
			})
			.where(eq(donations.id, fixture.donationId));
		return reservation;
	}

	it('moves an expired reservation to reconciliation', async () => {
		await makeReservationStale();
		expect(await reconcileStaleSubscriptionReservation(fixture.donationId)).toBe(true);
		const donation = await getDonation(fixture.donationId);
		expect(donation.subscriptionCreationStatus).toBe('reconciliation_required');
		expect(donation.subscriptionCreationToken).toBeNull();
		expect(donation.subscriptionCreationReservedAt).toBeNull();
		expect(donation.mollieSubscriptionId).toBeNull();
	});

	it('does not reconcile a recent reservation', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);
		if (!reservation) throw new Error('Reservation was not created');
		expect(await reconcileStaleSubscriptionReservation(fixture.donationId)).toBe(false);
		const donation = await getDonation(fixture.donationId);
		expect(donation.subscriptionCreationStatus).toBe('reserved');
		expect(donation.subscriptionCreationToken).toBe(reservation.token);
	});

	it('reconciles an expired reservation only once', async () => {
		await makeReservationStale();
		expect(await reconcileStaleSubscriptionReservation(fixture.donationId)).toBe(true);
		expect(await reconcileStaleSubscriptionReservation(fixture.donationId)).toBe(false);
	});

	it('allows only one concurrent stale reservation recovery', async () => {
		await makeReservationStale();
		const results = await Promise.all([
			reconcileStaleSubscriptionReservation(fixture.donationId),
			reconcileStaleSubscriptionReservation(fixture.donationId)
		]);
		expect(results.filter(Boolean)).toHaveLength(1);
		expect((await getDonation(fixture.donationId)).subscriptionCreationStatus).toBe(
			'reconciliation_required'
		);
	});

	it('does not reconcile an already registered subscription', async () => {
		const reservation = await reserveSubscriptionCreation(fixture.donationId);
		if (!reservation) throw new Error('Reservation was not created');
		await activateReservedSubscription(reservation, 'sub_registered', 'pending');
		expect(await reconcileStaleSubscriptionReservation(fixture.donationId)).toBe(false);
		const donation = await getDonation(fixture.donationId);
		expect(donation.subscriptionCreationStatus).toBe('activated');
		expect(donation.mollieSubscriptionId).toBe('sub_registered');
	});

	it('respects the expiration cutoff', async () => {
		await reserveSubscriptionCreation(fixture.donationId);
		const now = new Date('2026-10-18T12:00:00.000Z');
		await db
			.update(donations)
			.set({
				subscriptionCreationReservedAt: new Date(
					now.getTime() - SUBSCRIPTION_RESERVATION_TIMEOUT_MS + 1000
				)
			})
			.where(eq(donations.id, fixture.donationId));
		expect(await reconcileStaleSubscriptionReservation(fixture.donationId, now)).toBe(false);
	});
});
