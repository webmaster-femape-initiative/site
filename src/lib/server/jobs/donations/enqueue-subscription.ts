import type { PgBoss } from 'pg-boss';

export const SYNC_SUBSCRIPTION_QUEUE = 'donations.sync-subscription';

export function createSubscriptionEnqueuer(
	boss: PgBoss,
	queueName: string = SYNC_SUBSCRIPTION_QUEUE,
	singletonSeconds = 3600
) {
	return async function enqueueSubscription(subscriptionId: string): Promise<string | null> {
		if (!subscriptionId.trim()) {
			throw new Error('Subscription ID is required');
		}

		return boss.send(
			queueName,
			{ subscriptionId },
			{
				singletonKey: subscriptionId,
				singletonSeconds
			}
		);
	};
}
