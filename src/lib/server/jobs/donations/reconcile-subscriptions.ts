import type { Database } from '../../db/client.ts';

import { selectSubscriptionsToReconcile } from './select-subscriptions.ts';

export type SelectSubscriptions = () => Promise<string[]>;

export type EnqueueSubscription = (subscriptionId: string) => Promise<string | null>;

export type SubscriptionReconciliationResult = {
	processedCount: number;
	successCount: number;
	failureCount: number;
	message: string;
	errorDetails: string | null;
};

export function createSubscriptionReconciliationJob(
	db: Database,
	enqueueSubscription: EnqueueSubscription,
	selectSubscriptions: SelectSubscriptions = () => selectSubscriptionsToReconcile(db)
) {
	return async function reconcileSubscriptions(): Promise<SubscriptionReconciliationResult> {
		const subscriptionIds = await selectSubscriptions();

		let successCount = 0;
		let failureCount = 0;
		let skippedCount = 0;

		const errors: string[] = [];

		for (const subscriptionId of subscriptionIds) {
			try {
				const jobId = await enqueueSubscription(subscriptionId);

				if (jobId === null) {
					// Un job équivalent existe déjà.
					skippedCount++;
					continue;
				}

				successCount++;
			} catch (error) {
				failureCount++;

				const message = error instanceof Error ? error.message : String(error);

				errors.push(`${subscriptionId}: ${message}`);
			}
		}

		return {
			processedCount: subscriptionIds.length,
			successCount,
			failureCount,
			message:
				`Subscription dispatch: ${successCount} enqueued, ` +
				`${skippedCount} skipped, ${failureCount} failed`,
			errorDetails: errors.length > 0 ? errors.join('\n') : null
		};
	};
}
