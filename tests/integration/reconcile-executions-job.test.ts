import { describe, expect, it, vi } from 'vitest';

import type { createDb } from '../../src/lib/server/db/client.ts';

import { createReconcileExecutionsJob } from '../../src/lib/server/jobs/handlers/reconcile-executions.ts';

type DatabaseClient = ReturnType<typeof createDb>['client'];

describe('createReconcileExecutionsJob', () => {
	// Le client n'est pas utilisé par les fonctions simulées.
	// Il sert uniquement à vérifier le contrat d'injection.
	const client = {} as DatabaseClient;

	it('returns completed counters when there is nothing to reconcile', async () => {
		const reconcile = vi.fn().mockResolvedValue({
			abandonedJobs: 0,
			supersededAttempts: 0
		});

		const handler = createReconcileExecutionsJob(client, reconcile);

		const result = await handler();

		expect(reconcile).toHaveBeenCalledOnce();
		expect(reconcile).toHaveBeenCalledWith(client);

		expect(result).toEqual({
			processedCount: 0,
			successCount: 0,
			failureCount: 0,
			message: 'Execution reconciliation completed: ' + '0 abandoned, 0 superseded',
			errorDetails: null
		});
	});

	it('counts all reconciled executions', async () => {
		const reconcile = vi.fn().mockResolvedValue({
			abandonedJobs: 3,
			supersededAttempts: 2
		});

		const handler = createReconcileExecutionsJob(client, reconcile);

		const result = await handler();

		expect(result.processedCount).toBe(5);
		expect(result.successCount).toBe(5);
		expect(result.failureCount).toBe(0);

		expect(result.message).toBe(
			'Execution reconciliation completed: ' + '3 abandoned, 2 superseded'
		);

		expect(result.errorDetails).toBeNull();
	});

	it('propagates database errors to pg-boss', async () => {
		const error = new Error('PostgreSQL connection unavailable');

		const reconcile = vi.fn().mockRejectedValue(error);

		const handler = createReconcileExecutionsJob(client, reconcile);

		await expect(handler()).rejects.toBe(error);

		expect(reconcile).toHaveBeenCalledOnce();
	});
});
