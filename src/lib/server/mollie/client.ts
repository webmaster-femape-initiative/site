import { Client } from 'mollie-api-typescript';

import { env } from '$env/dynamic/private';

if (!env.MOLLIE_API_KEY) {
	throw new Error('MOLLIE_API_KEY is not set');
}

export const mollie = new Client({
	security: {
		apiKey: env.MOLLIE_API_KEY
	}
});
