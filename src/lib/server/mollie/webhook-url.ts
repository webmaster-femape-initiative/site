// src/lib/server/mollie/webhook-url.ts

import { env } from '$env/dynamic/private';

export function getMollieWebhookUrl(): string {
	const baseUrl = env.MOLLIE_WEBHOOK_BASE_URL?.trim();

	if (!baseUrl) {
		throw new Error('MOLLIE_WEBHOOK_BASE_URL is not configured.');
	}

	let url: URL;

	try {
		url = new URL(baseUrl);
	} catch {
		throw new Error('MOLLIE_WEBHOOK_BASE_URL is not a valid URL.');
	}

	if (url.protocol !== 'https:') {
		throw new Error('MOLLIE_WEBHOOK_BASE_URL must use HTTPS.');
	}

	url.pathname = '/api/mollie/webhook';
	url.search = '';
	url.hash = '';

	return url.toString();
}
