import type { createDb } from '../../db/client.ts';
import type { JobExecutionResult } from '../execution-log.ts';

import {
	reconcileInterruptedExecutions,
	type ReconciliationResult
} from '../reconcile-executions.ts';

type DatabaseClient = ReturnType<typeof createDb>['client'];

type ReconcileFunction = (client: DatabaseClient) => Promise<ReconciliationResult>;

export function createReconcileExecutionsJob(
	client: DatabaseClient,
	reconcile: ReconcileFunction = reconcileInterruptedExecutions
): () => Promise<JobExecutionResult> {
	return async () => {
		const result = await reconcile(client);

		const total = result.abandonedJobs + result.supersededAttempts;

		return {
			processedCount: total,
			successCount: total,
			failureCount: 0,
			message:
				`Execution reconciliation completed: ` +
				`${result.abandonedJobs} abandoned, ` +
				`${result.supersededAttempts} superseded`,
			errorDetails: null
		};
	};
}
