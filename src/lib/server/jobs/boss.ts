import { PgBoss } from 'pg-boss';

export function createBoss(connectionString: string): PgBoss {
	const boss = new PgBoss({
		connectionString,
		schema: 'pgboss',
		application_name: 'femape-worker'
	});

	boss.on('error', (error) => {
		console.error('[pg-boss] Error:', error);
	});

	return boss;
}
