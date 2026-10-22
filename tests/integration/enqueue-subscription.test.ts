import { beforeAll, afterAll, describe, expect, it } from 'vitest';

import { randomUUID } from 'node:crypto';

import { createBoss } from '../../src/lib/server/jobs/boss.ts';
import { createSubscriptionEnqueuer } from '../../src/lib/server/jobs/donations/enqueue-subscription.ts';

import { createDb } from '../../src/lib/server/db/client.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const boss = createBoss(connectionString);

const queueName = `test.enqueue-subscription.${randomUUID()}`;

const enqueueSubscription = createSubscriptionEnqueuer(boss, queueName);

describe('donations.sync-subscription - deduplication', () => {
	beforeAll(async () => {
		await boss.start();
		await boss.createQueue(queueName);
	}, 30_000);

	afterAll(async () => {
		await boss.stop();
	}, 30_000);

	it('deduplicates two successive sends', async () => {
		const subscriptionId = `sub_${randomUUID()}`;

		const firstJobId = await enqueueSubscription(subscriptionId);
		const secondJobId = await enqueueSubscription(subscriptionId);

		expect(firstJobId).toBeTruthy();
		expect(secondJobId).toBeNull();
	});

	it('deduplicates concurrent sends', async () => {
		const subscriptionId = `sub_${randomUUID()}`;

		const results = await Promise.all([
			enqueueSubscription(subscriptionId),
			enqueueSubscription(subscriptionId)
		]);

		const accepted = results.filter((jobId): jobId is string => jobId !== null);

		const rejected = results.filter((jobId) => jobId === null);

		expect(accepted).toHaveLength(1);
		expect(rejected).toHaveLength(1);
	});

	it('accepts jobs for different subscriptions', async () => {
		const firstSubscriptionId = `sub_${randomUUID()}`;
		const secondSubscriptionId = `sub_${randomUUID()}`;

		const [firstJobId, secondJobId] = await Promise.all([
			enqueueSubscription(firstSubscriptionId),
			enqueueSubscription(secondSubscriptionId)
		]);

		expect(firstJobId).toBeTruthy();
		expect(secondJobId).toBeTruthy();
		expect(firstJobId).not.toBe(secondJobId);
	});

	it('rejects an empty subscription ID', async () => {
		await expect(enqueueSubscription('')).rejects.toThrow('Subscription ID is required');
	});

	async function waitUntil(condition: () => Promise<boolean>, timeoutMs = 30_000): Promise<void> {
		const deadline = Date.now() + timeoutMs;

		while (Date.now() < deadline) {
			if (await condition()) return;

			await new Promise((resolve) => setTimeout(resolve, 200));
		}

		throw new Error('Timed out waiting for condition');
	}

	it('deduplicates a subscription while its job is waiting for retry', async () => {
		const retryQueue = `test.subscription-retry.${randomUUID()}`;
		const subscriptionId = `sub_${randomUUID()}`;

		await boss.createQueue(retryQueue, {
			retryLimit: 2,
			retryDelay: 30,
			retryBackoff: false
		});

		const enqueue = createSubscriptionEnqueuer(boss, retryQueue);

		const firstJobId = await enqueue(subscriptionId);
		expect(firstJobId).toBeTruthy();

		const { client } = createDb(connectionString);

		try {
			await boss.work(retryQueue, async () => {
				throw new Error('Simulated transient failure');
			});

			await waitUntil(async () => {
				const rows = await client`
                SELECT state
                FROM pgboss.job
                WHERE id = ${firstJobId}::uuid
            `;

				return rows[0]?.state === 'retry';
			});

			const secondJobId = await enqueue(subscriptionId);

			expect(secondJobId).toBeNull();
		} finally {
			await client.end();
		}
	}, 45_000);

	it('allows another job after the singleton window expires', async () => {
		const expiryQueue = `test.subscription-expiry.${randomUUID()}`;
		const subscriptionId = `sub_${randomUUID()}`;

		await boss.createQueue(expiryQueue);

		const enqueue = createSubscriptionEnqueuer(boss, expiryQueue, 2);

		const firstJobId = await enqueue(subscriptionId);
		expect(firstJobId).toBeTruthy();

		// Aucun consommateur : le premier job reste en attente.
		const secondJobId = await enqueue(subscriptionId);
		expect(secondJobId).toBeNull();

		// Attendre le changement de créneau de déduplication.
		await new Promise((resolve) => setTimeout(resolve, 4500));

		const thirdJobId = await enqueue(subscriptionId);

		expect(thirdJobId).toBeTruthy();
		expect(thirdJobId).not.toBe(firstJobId);
	}, 15_000);
});
