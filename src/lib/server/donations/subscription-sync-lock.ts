import type { Sql } from 'postgres';

export type SubscriptionLockResult<T> = { acquired: true; result: T } | { acquired: false };

export class SubscriptionLockReleaseError extends Error {
	constructor(subscriptionId: string) {
		super(`Failed to release PostgreSQL advisory lock for subscription ${subscriptionId}`);

		this.name = 'SubscriptionLockReleaseError';
	}
}

export function createSubscriptionLock(client: Sql) {
	return async function withSubscriptionLock<T>(
		subscriptionId: string,
		handler: () => Promise<T>
	): Promise<SubscriptionLockResult<T>> {
		const connection = await client.reserve();

		let acquired = false;
		let releaseError: unknown = null;
		let handlerError: unknown = null;
		let result: T | undefined;
		let handlerSucceeded = false;

		try {
			const rows = await connection`
                SELECT pg_try_advisory_lock(
                    hashtextextended(${subscriptionId}, 0)
                ) AS acquired
            `;

			acquired = rows[0]?.acquired === true;

			if (acquired) {
				try {
					result = await handler();
					handlerSucceeded = true;
				} catch (error) {
					handlerError = error;
				}
			}
		} catch (error) {
			handlerError = error;
		} finally {
			try {
				if (acquired) {
					const rows = await connection`
                        SELECT pg_advisory_unlock(
                            hashtextextended(${subscriptionId}, 0)
                        ) AS released
                    `;

					if (rows[0]?.released !== true) {
						releaseError = new SubscriptionLockReleaseError(subscriptionId);
					}
				}
			} catch (error) {
				releaseError = error;
			}

			try {
				await connection.release();
			} catch (error) {
				releaseError ??= error;
			}
		}

		// Les exceptions sont propagées en dehors du finally.
		if (handlerError !== null) {
			throw handlerError;
		}

		if (releaseError !== null) {
			throw releaseError;
		}

		if (!acquired) {
			return { acquired: false };
		}

		if (!handlerSucceeded) {
			throw new Error('Subscription lock handler did not complete');
		}

		return {
			acquired: true,
			result: result as T
		};
	};
}
