import { Client } from 'mollie-api-typescript';

export function createMollieClient(apiKey: string): Client {
	if (!apiKey.trim()) {
		throw new Error('MOLLIE_API_KEY is not set');
	}

	return new Client({
		security: {
			apiKey
		}
	});
}

export type MollieClient = ReturnType<typeof createMollieClient>;
