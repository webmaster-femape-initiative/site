import { and, eq, isNotNull } from 'drizzle-orm';

import type { Database } from '../../db/client.ts';
import { donations } from '../../db/schema.ts';

export async function selectSubscriptionsToReconcile(db: Database): Promise<string[]> {
	const rows = await db
		.select({
			subscriptionId: donations.mollieSubscriptionId
		})
		.from(donations)
		.where(
			and(
				eq(donations.type, 'recurring'),
				eq(donations.subscriptionCreationStatus, 'activated'),
				isNotNull(donations.mollieSubscriptionId)
			)
		);

	return rows.map((row) => row.subscriptionId).filter((id): id is string => id !== null);
}
