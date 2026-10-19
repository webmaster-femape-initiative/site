import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { donations, donors } from '$lib/server/db/schema';
import { syncMollieSubscription } from '$lib/server/donations/sync-subscription-status';
import {
    createRecurringDonationFixture,
    type RecurringDonationFixture
} from '../fixtures/recurring-donations';

const mollieMocks = vi.hoisted(() => ({
    getMollieSubscription: vi.fn()
}));

vi.mock('$lib/server/mollie/subscriptions', () => ({
    getMollieSubscription: mollieMocks.getMollieSubscription
}));

type MollieStatus = 'pending' | 'active' | 'suspended' | 'canceled' | 'completed';

const customerId = 'cst_sync_test';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('Recurring Mollie subscription status synchronization (PostgreSQL)', () => {
    let fixture: RecurringDonationFixture;
    let subscriptionId: string;

    async function getDonation() {
        const [donation] = await db
            .select()
            .from(donations)
            .where(eq(donations.id, fixture.donationId))
            .limit(1);
        if (!donation) throw new Error(`Donation ${fixture.donationId} not found`);
        return donation;
    }

    function respondWith(status: MollieStatus, metadata?: unknown) {
        mollieMocks.getMollieSubscription.mockResolvedValue({
            id: subscriptionId,
            status,
            metadata: metadata === undefined ? { donationId: fixture.donationId } : metadata
        });
    }

    beforeEach(async () => {
        vi.resetAllMocks();
        fixture = await createRecurringDonationFixture();
        subscriptionId = `sub_sync_${crypto.randomUUID()}`;

        await db.update(donors)
            .set({ mollieCustomerId: customerId })
            .where(eq(donors.id, fixture.donorId));

        await db.update(donations)
            .set({
                status: 'pending',
                mollieSubscriptionId: subscriptionId,
                subscriptionCreationStatus: 'activated',
                mollieSubscriptionStatus: 'pending',
                mollieSubscriptionSyncedAt: null,
                cancelledAt: null,
                completedAt: null
            })
            .where(eq(donations.id, fixture.donationId));

        respondWith('pending');
    });

    afterEach(async () => {
        if (fixture) await fixture.cleanup();
    });

    it('activates a pending donation and stores the technical status', async () => {
        respondWith('active');
        expect(await syncMollieSubscription(subscriptionId)).toBe('updated');
        const donation = await getDonation();
        expect(donation.status).toBe('active');
        expect(donation.mollieSubscriptionStatus).toBe('active');
        expect(donation.mollieSubscriptionSyncedAt).toBeInstanceOf(Date);
        expect(mollieMocks.getMollieSubscription).toHaveBeenCalledWith({
            customerId,
            subscriptionId
        });
    });

    it('does not regress an active donation to pending', async () => {
        await db.update(donations)
            .set({ status: 'active', mollieSubscriptionStatus: 'active' })
            .where(eq(donations.id, fixture.donationId));
        respondWith('pending');
        expect(await syncMollieSubscription(subscriptionId)).toBe('updated');
        const donation = await getDonation();
        expect(donation.status).toBe('active');
        expect(donation.mollieSubscriptionStatus).toBe('pending');
    });

    it('records suspension without cancelling the donation', async () => {
        await db.update(donations)
            .set({ status: 'active', mollieSubscriptionStatus: 'active' })
            .where(eq(donations.id, fixture.donationId));
        respondWith('suspended');
        expect(await syncMollieSubscription(subscriptionId)).toBe('suspended');
        const donation = await getDonation();
        expect(donation.status).toBe('active');
        expect(donation.mollieSubscriptionStatus).toBe('suspended');
        expect(donation.cancelledAt).toBeNull();
    });

    it('records reactivation after suspension', async () => {
        await db.update(donations)
            .set({ status: 'active', mollieSubscriptionStatus: 'suspended' })
            .where(eq(donations.id, fixture.donationId));
        respondWith('active');
        expect(await syncMollieSubscription(subscriptionId)).toBe('updated');
        const donation = await getDonation();
        expect(donation.status).toBe('active');
        expect(donation.mollieSubscriptionStatus).toBe('active');
    });

    it('cancels the donation and records cancelledAt', async () => {
        respondWith('canceled');
        expect(await syncMollieSubscription(subscriptionId)).toBe('updated');
        const donation = await getDonation();
        expect(donation.status).toBe('cancelled');
        expect(donation.mollieSubscriptionStatus).toBe('canceled');
        expect(donation.cancelledAt).toBeInstanceOf(Date);
        expect(donation.completedAt).toBeNull();
    });

    it('completes the donation and records completedAt', async () => {
        respondWith('completed');
        expect(await syncMollieSubscription(subscriptionId)).toBe('updated');
        const donation = await getDonation();
        expect(donation.status).toBe('completed');
        expect(donation.mollieSubscriptionStatus).toBe('completed');
        expect(donation.completedAt).toBeInstanceOf(Date);
        expect(donation.cancelledAt).toBeNull();
    });

    it.each(['cancelled', 'completed', 'failed'] as const)(
        'does not reactivate a terminal donation (%s)',
        async (status) => {
            await db.update(donations)
                .set({ status, mollieSubscriptionStatus: 'canceled' })
                .where(eq(donations.id, fixture.donationId));
            respondWith('active');
            expect(await syncMollieSubscription(subscriptionId)).toBe('terminal');
            const donation = await getDonation();
            expect(donation.status).toBe(status);
            expect(donation.mollieSubscriptionStatus).toBe('active');
        }
    );

    it('returns unchanged when the status is already synchronized', async () => {
        expect(await syncMollieSubscription(subscriptionId)).toBe('unchanged');
        expect((await getDonation()).status).toBe('pending');
        expect((await getDonation()).mollieSubscriptionSyncedAt).toBeInstanceOf(Date);
    });

    it('rejects an unrelated donation ID without persisting changes', async () => {
        respondWith('active', { donationId: crypto.randomUUID() });
        await expect(syncMollieSubscription(subscriptionId))
            .rejects.toThrow('belongs to another donation');
        const donation = await getDonation();
        expect(donation.status).toBe('pending');
        expect(donation.mollieSubscriptionSyncedAt).toBeNull();
    });

    it('rolls back on a Mollie API error', async () => {
        mollieMocks.getMollieSubscription.mockRejectedValue(new Error('Mollie unavailable'));
        await expect(syncMollieSubscription(subscriptionId))
            .rejects.toThrow('Mollie unavailable');
        expect((await getDonation()).mollieSubscriptionSyncedAt).toBeNull();
    });

    it('serializes two synchronizations of the same subscription', async () => {
        const firstStarted = deferred<void>();
        const releaseFirst = deferred<void>();
        let calls = 0;

        mollieMocks.getMollieSubscription.mockImplementation(async () => {
            calls++;
            if (calls === 1) {
                firstStarted.resolve();
                await releaseFirst.promise;
                return {
                    id: subscriptionId,
                    status: 'pending',
                    metadata: { donationId: fixture.donationId }
                };
            }
            return {
                id: subscriptionId,
                status: 'active',
                metadata: { donationId: fixture.donationId }
            };
        });

        const first = syncMollieSubscription(subscriptionId);
        await firstStarted.promise;
        const second = syncMollieSubscription(subscriptionId);

        try {
            // Allow the second transaction an opportunity to reach the lock.
            // No arbitrary sleep is used to determine the final database state.
            await new Promise<void>((resolve) => setImmediate(resolve));
            expect(calls).toBe(1);
        } finally {
            releaseFirst.resolve();
        }

        const results = await Promise.all([first, second]);
        expect(results).toEqual(['unchanged', 'updated']);
        expect(calls).toBe(2);
        const donation = await getDonation();
        expect(donation.status).toBe('active');
        expect(donation.mollieSubscriptionStatus).toBe('active');
    });
});
