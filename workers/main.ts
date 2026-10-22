import { createBoss } from '../src/lib/server/jobs/boss.ts';
import { createDb } from '../src/lib/server/db/client.ts';
import { createJobExecutionLogger } from '../src/lib/server/jobs/execution-log.ts';
import { reconcileInterruptedExecutions } from '../src/lib/server/jobs/reconcile-executions.ts';

import { createMollieClient } from '../src/lib/server/mollie/client-factory.ts';
import { createGetMollieSubscription } from '../src/lib/server/mollie/get-subscription.ts';

import { createSubscriptionSynchronizer } from '../src/lib/server/donations/subscription-sync-core.ts';

import { createSubscriptionReconciliationJob } from '../src/lib/server/jobs/donations/reconcile-subscriptions.ts';
import { createSubscriptionEnqueuer } from '../src/lib/server/jobs/donations/enqueue-subscription.ts';

import { createSubscriptionLock } from '../src/lib/server/donations/subscription-sync-lock.ts';

import { createReconcileExecutionsJob } from '../src/lib/server/jobs/handlers/reconcile-executions.ts';

import {
	createSyncSubscriptionJob,
	type SyncSubscriptionJobData
} from '../src/lib/server/jobs/donations/sync-subscription.ts';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

const boss = createBoss(connectionString);
const { db, client } = createDb(connectionString);

const mollie = createMollieClient(process.env.MOLLIE_API_KEY ?? '');

const getMollieSubscription = createGetMollieSubscription(mollie);

const withSubscriptionLock = createSubscriptionLock(client);

const syncMollieSubscription = createSubscriptionSynchronizer(
	db,
	getMollieSubscription,
	withSubscriptionLock
);

// Envoi des synchronisations individuelles dans pg-boss.
const enqueueSubscription = createSubscriptionEnqueuer(boss);

// Le job périodique distribue désormais les traitements.
const reconcileSubscriptions = createSubscriptionReconciliationJob(db, enqueueSubscription);

// Chaque job individuel effectue sa propre synchronisation Mollie.
const syncSubscriptionJob = createSyncSubscriptionJob(syncMollieSubscription);

const withJobExecutionLog = createJobExecutionLogger(db, client);

const reconcileExecutionsJob = createReconcileExecutionsJob(client);

let stopping = false;

async function shutdown(signal: string): Promise<void> {
	if (stopping) return;

	stopping = true;

	console.info(`[worker] Received ${signal}`);

	try {
		await boss.stop();
		await client.end();

		console.info('[worker] Stopped');
	} catch (error) {
		console.error('[worker] Shutdown error:', error);
		process.exitCode = 1;
	}
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

async function main(): Promise<void> {
	await boss.start();

	console.info('[worker] pg-boss started');

	const reconciliation = await reconcileInterruptedExecutions(client);

	console.info('[worker] Execution reconciliation:', reconciliation);

	// ---------------------------------------------------------
	// Queue : system.health-check
	// ---------------------------------------------------------

	await boss.createQueue('system.health-check');

	await boss.work('system.health-check', async ([job]) => {
		await withJobExecutionLog(
			{
				jobId: job.id,
				jobName: job.name,
				attemptNumber: job.retryCount + 1
			},
			async () => {
				console.info('[worker] Health check:', {
					jobId: job.id,
					attemptNumber: job.retryCount + 1,
					executedAt: new Date().toISOString()
				});

				return {
					processedCount: 1,
					successCount: 1,
					failureCount: 0,
					message: 'Worker operational'
				};
			}
		);
	});

	// ---------------------------------------------------------
	// Queue : system.reconcile-executions
	// ---------------------------------------------------------

	await boss.createQueue('system.reconcile-executions', {
		retryLimit: 3,
		retryDelay: 30,
		retryBackoff: true
	});

	await boss.work('system.reconcile-executions', async ([job]) => {
		await withJobExecutionLog(
			{
				jobId: job.id,
				jobName: job.name,
				attemptNumber: job.retryCount + 1
			},
			async () => {
				const result = await reconcileExecutionsJob();

				console.info('[worker] Execution reconciliation:', {
					jobId: job.id,
					...result
				});

				return result;
			}
		);
	});

	// ---------------------------------------------------------
	// Queue : donations.sync-subscription
	// ---------------------------------------------------------

	await boss.createQueue('donations.sync-subscription', {
		retryLimit: 5,
		retryDelay: 60,
		retryBackoff: true
	});

	await boss.work<SyncSubscriptionJobData>('donations.sync-subscription', async ([job]) => {
		await withJobExecutionLog(
			{
				jobId: job.id,
				jobName: job.name,
				attemptNumber: job.retryCount + 1
			},
			async () => {
				console.info('[worker] Synchronizing Mollie subscription:', {
					jobId: job.id,
					subscriptionId: job.data.subscriptionId,
					attemptNumber: job.retryCount + 1
				});

				return syncSubscriptionJob(job.data);
			}
		);
	});

	// ---------------------------------------------------------
	// Queue : donations.reconcile-subscriptions
	// ---------------------------------------------------------

	await boss.createQueue('donations.reconcile-subscriptions');

	await boss.work('donations.reconcile-subscriptions', async ([job]) => {
		await withJobExecutionLog(
			{
				jobId: job.id,
				jobName: job.name,
				attemptNumber: job.retryCount + 1
			},
			async () => {
				console.info('[worker] Dispatching Mollie subscription jobs');

				return reconcileSubscriptions();
			}
		);
	});

	// ---------------------------------------------------------
	// Schedules
	// ---------------------------------------------------------

	await boss.schedule('system.health-check', '*/5 * * * *', {}, { tz: 'Europe/Paris' });

	console.info('[worker] Health check scheduled');

	await boss.schedule('system.reconcile-executions', '*/5 * * * *', {}, { tz: 'Europe/Paris' });

	console.info('[worker] Execution reconciliation scheduled');

	await boss.schedule(
		'donations.reconcile-subscriptions',
		'0 */6 * * *',
		{},
		{ tz: 'Europe/Paris' }
	);

	console.info('[worker] Mollie subscription reconciliation scheduled');

	console.info('[worker] Individual Mollie subscription worker registered');
}

main().catch(async (error) => {
	console.error('[worker] Startup failed:', error);

	process.exitCode = 1;

	await boss.stop().catch(console.error);
	await client.end().catch(console.error);
});
