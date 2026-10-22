import { env } from '$env/dynamic/private';
import { createMollieClient } from './client-factory.ts';

export const mollie = createMollieClient(env.MOLLIE_API_KEY ?? '');
