import { afterAll, describe, expect, it, vi } from 'vitest';

import { randomUUID } from 'node:crypto';
import postgres from 'postgres';

import { createSubscriptionLock } from '../../src/lib/server/donations/subscription-sync-lock.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

// Deux pools indépendants : simulation de deux workers.
const clientA = postgres(connectionString, {
	max: 1
});

const clientB = postgres(connectionString, {
	max: 1
});

const withLockA = createSubscriptionLock(clientA);
const withLockB = createSubscriptionLock(clientB);

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;

	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

describe('subscription synchronization PostgreSQL lock', () => {
	afterAll(async () => {
		await Promise.all([clientA.end(), clientB.end()]);
	});

	it('acquires the lock and executes the handler', async () => {
		const subscriptionId = `sub_${randomUUID()}`;

		const result = await withLockA(subscriptionId, async () => 'synchronized');

		expect(result).toEqual({
			acquired: true,
			result: 'synchronized'
		});
	});

	it('prevents two workers from processing the same subscription', async () => {
		const subscriptionId = `sub_${randomUUID()}`;

		const entered = createDeferred<void>();
		const release = createDeferred<void>();

		const firstExecution = withLockA(subscriptionId, async () => {
			entered.resolve();
			await release.promise;
			return 'first-worker';
		});

		try {
			// Le premier worker détient maintenant le verrou.
			await entered.promise;

			const secondHandler = vi.fn(async () => 'second-worker');

			const secondResult = await withLockB(subscriptionId, secondHandler);

			expect(secondResult).toEqual({
				acquired: false
			});

			expect(secondHandler).not.toHaveBeenCalled();
		} finally {
			release.resolve();
		}

		expect(await firstExecution).toEqual({
			acquired: true,
			result: 'first-worker'
		});
	});

	it('allows different subscriptions to run concurrently', async () => {
		const firstSubscriptionId = `sub_${randomUUID()}`;
		const secondSubscriptionId = `sub_${randomUUID()}`;

		const entered = createDeferred<void>();
		const release = createDeferred<void>();

		const firstExecution = withLockA(firstSubscriptionId, async () => {
			entered.resolve();
			await release.promise;
			return 'first';
		});

		try {
			await entered.promise;

			const secondResult = await withLockB(secondSubscriptionId, async () => 'second');

			expect(secondResult).toEqual({
				acquired: true,
				result: 'second'
			});
		} finally {
			release.resolve();
		}

		expect(await firstExecution).toEqual({
			acquired: true,
			result: 'first'
		});
	});

	it('releases the lock when the handler throws', async () => {
		const subscriptionId = `sub_${randomUUID()}`;

		await expect(
			withLockA(subscriptionId, async () => {
				throw new Error('Simulated Mollie failure');
			})
		).rejects.toThrow('Simulated Mollie failure');

		const result = await withLockB(subscriptionId, async () => 'retry-succeeded');

		expect(result).toEqual({
			acquired: true,
			result: 'retry-succeeded'
		});
	});

	it('releases the lock after a successful execution', async () => {
		const subscriptionId = `sub_${randomUUID()}`;

		const firstResult = await withLockA(subscriptionId, async () => 'first');

		const secondResult = await withLockB(subscriptionId, async () => 'second');

		expect(firstResult).toEqual({
			acquired: true,
			result: 'first'
		});

		expect(secondResult).toEqual({
			acquired: true,
			result: 'second'
		});
	});
});
