import type { SubscriptionSyncResult } from '../../donations/subscription-sync-core.ts';

import { classifySubscriptionSyncError } from '../../donations/subscription-sync-errors.ts';

export type SyncSubscription = (subscriptionId: string) => Promise<SubscriptionSyncResult>;

export type SyncSubscriptionJobData = {
	subscriptionId: string;
};

export type SyncSubscriptionJobResult = {
	processedCount: number;
	successCount: number;
	failureCount: number;
	message: string;
	errorDetails: string | null;
};

export function createSyncSubscriptionJob(syncSubscription: SyncSubscription) {
	return async function syncSubscriptionJob(
		data: SyncSubscriptionJobData
	): Promise<SyncSubscriptionJobResult> {
		const subscriptionId = data.subscriptionId;

		if (typeof subscriptionId !== 'string' || !subscriptionId.trim()) {
			return {
				processedCount: 1,
				successCount: 0,
				failureCount: 1,
				message: 'Invalid subscription job payload',
				errorDetails: 'Missing Mollie subscription ID'
			};
		}

		try {
			const result = await syncSubscription(subscriptionId);

			if (result === 'not_found') {
				return {
					processedCount: 1,
					successCount: 0,
					failureCount: 1,
					message: 'Subscription not found locally',
					errorDetails: `No local donation found for ${subscriptionId}`
				};
			}

			if (result === 'already_running') {
				return {
					processedCount: 1,
					successCount: 0,
					failureCount: 0,
					message: 'Subscription synchronization already running',
					errorDetails: null
				};
			}

			if (result === 'superseded') {
				return {
					processedCount: 1,
					successCount: 0,
					failureCount: 0,
					message: 'Subscription synchronization superseded by a newer execution',
					errorDetails: null
				};
			}

			return {
				processedCount: 1,
				successCount: 1,
				failureCount: 0,
				message: `Subscription ${subscriptionId} synchronized: ${result}`,
				errorDetails: null
			};
		} catch (error) {
			const classification = classifySubscriptionSyncError(error);

			if (classification.retryable) {
				// pg-boss doit recevoir l'exception pour
				// pouvoir déclencher une nouvelle tentative.
				throw error;
			}

			return {
				processedCount: 1,
				successCount: 0,
				failureCount: 1,
				message: `Subscription ${subscriptionId} synchronization failed`,
				errorDetails: `[${classification.kind}/${classification.code}] ` + classification.message
			};
		}
	};
}
