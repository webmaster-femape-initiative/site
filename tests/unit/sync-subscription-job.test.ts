import { describe, expect, it, vi } from 'vitest';

import type { SubscriptionSyncResult } from '../../src/lib/server/donations/subscription-sync-core.ts';

import { SubscriptionSyncValidationError } from '../../src/lib/server/donations/subscription-sync-errors.ts';

import { createSyncSubscriptionJob } from '../../src/lib/server/jobs/donations/sync-subscription.ts';

type SyncSubscription = (subscriptionId: string) => Promise<SubscriptionSyncResult>;

describe('donations.sync-subscription', () => {
	it.each(['updated', 'unchanged', 'terminal', 'suspended'] as SubscriptionSyncResult[])(
		'records %s as success',
		async (status) => {
			const sync = vi.fn<SyncSubscription>().mockResolvedValue(status);

			const handler = createSyncSubscriptionJob(sync);

			const result = await handler({
				subscriptionId: 'sub_123'
			});

			expect(result).toMatchObject({
				processedCount: 1,
				successCount: 1,
				failureCount: 0,
				errorDetails: null
			});

			expect(sync).toHaveBeenCalledWith('sub_123');
		}
	);

	it('handles missing local subscription without retry', async () => {
		const sync = vi.fn<SyncSubscription>().mockResolvedValue('not_found');

		const handler = createSyncSubscriptionJob(sync);

		const result = await handler({
			subscriptionId: 'sub_missing'
		});

		expect(result).toMatchObject({
			processedCount: 1,
			successCount: 0,
			failureCount: 1
		});

		expect(result.errorDetails).toContain('sub_missing');
	});

	it('does not retry validation errors', async () => {
		const sync = vi
			.fn<SyncSubscription>()
			.mockRejectedValue(
				new SubscriptionSyncValidationError('invalid_metadata', 'Donation ID mismatch')
			);

		const handler = createSyncSubscriptionJob(sync);

		const result = await handler({
			subscriptionId: 'sub_123'
		});

		expect(result.failureCount).toBe(1);
		expect(result.errorDetails).toContain('invalid_metadata');
	});

	it('propagates HTTP 503 for retry', async () => {
		const error = Object.assign(new Error('Mollie unavailable'), { status: 503 });

		const sync = vi.fn<SyncSubscription>().mockRejectedValue(error);

		const handler = createSyncSubscriptionJob(sync);

		await expect(handler({ subscriptionId: 'sub_123' })).rejects.toBe(error);
	});

	it('propagates HTTP 429 for retry', async () => {
		const error = Object.assign(new Error('Rate limit exceeded'), { status: 429 });

		const sync = vi.fn<SyncSubscription>().mockRejectedValue(error);

		const handler = createSyncSubscriptionJob(sync);

		await expect(handler({ subscriptionId: 'sub_123' })).rejects.toBe(error);
	});

	it('does not retry HTTP 401', async () => {
		const error = Object.assign(new Error('Invalid API key'), { status: 401 });

		const sync = vi.fn<SyncSubscription>().mockRejectedValue(error);

		const handler = createSyncSubscriptionJob(sync);

		const result = await handler({
			subscriptionId: 'sub_123'
		});

		expect(result.failureCount).toBe(1);
		expect(result.errorDetails).toContain('configuration');
	});

	it('rejects an invalid job payload without calling Mollie', async () => {
		const sync = vi.fn<SyncSubscription>();

		const handler = createSyncSubscriptionJob(sync);

		const result = await handler({
			subscriptionId: ''
		});

		expect(result.failureCount).toBe(1);
		expect(sync).not.toHaveBeenCalled();
	});
});
