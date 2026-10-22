import type { MollieClient } from './client-factory.ts';

export type GetMollieSubscriptionData = {
	customerId: string;
	subscriptionId: string;
};

export function createGetMollieSubscription(client: MollieClient) {
	return async function getMollieSubscription(data: GetMollieSubscriptionData) {
		if (!data.customerId.trim()) {
			throw new Error('Mollie customer ID is required');
		}

		if (!data.subscriptionId.trim()) {
			throw new Error('Mollie subscription ID is required');
		}

		return client.subscriptions.get({
			customerId: data.customerId,
			subscriptionId: data.subscriptionId
		});
	};
}
