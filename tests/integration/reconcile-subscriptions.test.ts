import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../../src/lib/server/db/client.ts';

import {
	createSubscriptionReconciliationJob,
	type EnqueueSubscription
} from '../../src/lib/server/jobs/donations/reconcile-subscriptions.ts';

function createTestJob(subscriptionIds: string[], enqueueSubscription: EnqueueSubscription) {
	const db = {} as Database;

	const selectSubscriptions = vi.fn().mockResolvedValue(subscriptionIds);

	const reconcile = createSubscriptionReconciliationJob(
		db,
		enqueueSubscription,
		selectSubscriptions
	);

	return { reconcile, selectSubscriptions };
}

describe('donations.reconcile-subscriptions - dispatch', () => {
	it('handles an empty subscription list', async () => {
		const enqueue = vi.fn<EnqueueSubscription>();

		const { reconcile } = createTestJob([], enqueue);

		const result = await reconcile();

		expect(result).toMatchObject({
			processedCount: 0,
			successCount: 0,
			failureCount: 0,
			errorDetails: null
		});

		expect(enqueue).not.toHaveBeenCalled();
	});

	it('enqueues every selected subscription', async () => {
		const enqueue = vi
			.fn<EnqueueSubscription>()
			.mockResolvedValueOnce('job_1')
			.mockResolvedValueOnce('job_2')
			.mockResolvedValueOnce('job_3');

		const { reconcile } = createTestJob(['sub_1', 'sub_2', 'sub_3'], enqueue);

		const result = await reconcile();

		expect(result).toMatchObject({
			processedCount: 3,
			successCount: 3,
			failureCount: 0
		});

		expect(enqueue).toHaveBeenNthCalledWith(1, 'sub_1');
		expect(enqueue).toHaveBeenNthCalledWith(2, 'sub_2');
		expect(enqueue).toHaveBeenNthCalledWith(3, 'sub_3');
	});

	it('skips subscriptions already queued', async () => {
		const enqueue = vi
			.fn<EnqueueSubscription>()
			.mockResolvedValueOnce('job_1')
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce('job_3');

		const { reconcile } = createTestJob(['sub_1', 'sub_2', 'sub_3'], enqueue);

		const result = await reconcile();

		expect(result.processedCount).toBe(3);
		expect(result.successCount).toBe(2);
		expect(result.failureCount).toBe(0);
		expect(result.message).toContain('1 skipped');
	});

	it('continues after an enqueue error', async () => {
		const enqueue = vi
			.fn<EnqueueSubscription>()
			.mockResolvedValueOnce('job_1')
			.mockRejectedValueOnce(new Error('pg-boss unavailable'))
			.mockResolvedValueOnce('job_3');

		const { reconcile } = createTestJob(['sub_1', 'sub_2', 'sub_3'], enqueue);

		const result = await reconcile();

		expect(result).toMatchObject({
			processedCount: 3,
			successCount: 2,
			failureCount: 1
		});

		expect(result.errorDetails).toContain('sub_2: pg-boss unavailable');

		expect(enqueue).toHaveBeenCalledTimes(3);
	});

	it('reports a complete enqueue failure', async () => {
		const enqueue = vi
			.fn<EnqueueSubscription>()
			.mockRejectedValue(new Error('Database unavailable'));

		const { reconcile } = createTestJob(['sub_1', 'sub_2'], enqueue);

		const result = await reconcile();

		expect(result).toMatchObject({
			processedCount: 2,
			successCount: 0,
			failureCount: 2
		});
	});

	it('propagates subscription selection errors', async () => {
		const db = {} as Database;

		const enqueue = vi.fn<EnqueueSubscription>();

		const selectSubscriptions = vi.fn().mockRejectedValue(new Error('Selection failed'));

		const reconcile = createSubscriptionReconciliationJob(db, enqueue, selectSubscriptions);

		await expect(reconcile()).rejects.toThrow('Selection failed');

		expect(enqueue).not.toHaveBeenCalled();
	});
});
