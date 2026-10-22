import { PgBoss } from 'pg-boss';

import { createDb } from '../../src/lib/server/db/client.ts';
import { createJobExecutionLogger } from '../../src/lib/server/jobs/execution-log.ts';

import { createSubscriptionLock } from '../../src/lib/server/donations/subscription-sync-lock.ts';
import { createSubscriptionSynchronizer } from '../../src/lib/server/donations/subscription-sync-core.ts';
import { createSyncSubscriptionJob } from '../../src/lib/server/jobs/donations/sync-subscription.ts';

import type { SyncSubscriptionJobData } from '../../src/lib/server/jobs/donations/sync-subscription.ts';

function requiredEnv(name: string): string {
	const value = process.env[name];

	if (!value) {
		throw new Error(`${name} is not set`);
	}

	return value;
}

const connectionString = requiredEnv('DATABASE_URL');
const queueName = requiredEnv('TEST_QUEUE_NAME');

if (!connectionString) {
	throw new Error('DATABASE_URL is not set');
}

if (!queueName) {
	throw new Error('TEST_QUEUE_NAME is not set');
}

const boss = new PgBoss({ connectionString });
const { db, client } = createDb(connectionString);

const withSubscriptionLock = createSubscriptionLock(client);

function waitForever(): Promise<never> {
	return new Promise<never>(() => {
		// Cette promesse ne se résout volontairement jamais.
		// Le processus parent interrompra ce worker.
	});
}

const getSubscription = async () => {
	// Le signal est envoyé depuis l'appel simulé à Mollie.
	// À ce stade, le synchroniseur doit déjà avoir acquis
	// le verrou consultatif PostgreSQL.
	if (process.send) {
		process.send({
			type: 'mollie-call-started'
		});
	}

	return waitForever();
};

const synchronize = createSubscriptionSynchronizer(db, getSubscription, withSubscriptionLock);

const processJob = createSyncSubscriptionJob(synchronize);

const withJobExecutionLog = createJobExecutionLogger(db, client);

async function main(): Promise<void> {
	await boss.start();

	await boss.work<SyncSubscriptionJobData>(queueName, async ([job]) => {
		await withJobExecutionLog(
			{
				jobId: job.id,
				jobName: job.name,
				attemptNumber: job.retryCount + 1
			},
			() => processJob(job.data)
		);
	});

	if (process.send) {
		process.send({
			type: 'worker-ready'
		});
	}
}

main().catch(async (error) => {
	console.error('[crashable-worker] Startup failed:', error);

	await boss.stop().catch(console.error);
	await client.end().catch(console.error);

	process.exitCode = 1;
});
