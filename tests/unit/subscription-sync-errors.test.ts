import { describe, expect, it } from 'vitest';

import {
	classifySubscriptionSyncError,
	SubscriptionSyncValidationError
} from '../../src/lib/server/donations/subscription-sync-errors.ts';

describe('classifySubscriptionSyncError', () => {
	it.each([500, 502, 503, 504])('classifies HTTP %i as transient', (status) => {
		const result = classifySubscriptionSyncError({
			status,
			message: 'Server error'
		});

		expect(result.kind).toBe('transient');
		expect(result.retryable).toBe(true);
		expect(result.code).toBe('server_error');
	});

	it('classifies HTTP 429 as retryable', () => {
		const result = classifySubscriptionSyncError({
			status: 429
		});

		expect(result).toMatchObject({
			kind: 'transient',
			code: 'rate_limited',
			retryable: true,
			httpStatus: 429
		});
	});

	it.each([401, 403])('classifies HTTP %i as configuration error', (status) => {
		const result = classifySubscriptionSyncError({
			status
		});

		expect(result.kind).toBe('configuration');
		expect(result.retryable).toBe(false);
	});

	it('classifies HTTP 404 as permanent', () => {
		const result = classifySubscriptionSyncError({
			status: 404
		});

		expect(result).toMatchObject({
			kind: 'permanent',
			code: 'not_found',
			retryable: false
		});
	});

	it('classifies network timeout as transient', () => {
		const error = Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' });

		const result = classifySubscriptionSyncError(error);

		expect(result).toMatchObject({
			kind: 'transient',
			code: 'network_error',
			retryable: true
		});
	});

	it('classifies invalid metadata as permanent', () => {
		const error = new SubscriptionSyncValidationError('invalid_metadata', 'Donation ID mismatch');

		const result = classifySubscriptionSyncError(error);

		expect(result).toMatchObject({
			kind: 'permanent',
			code: 'invalid_metadata',
			retryable: false
		});
	});

	it('does not automatically retry unknown errors', () => {
		const result = classifySubscriptionSyncError(new Error('Unexpected error'));

		expect(result).toMatchObject({
			kind: 'permanent',
			code: 'unknown',
			retryable: false
		});
	});

	it('classifies unsupported Mollie status as permanent', () => {
		const error = new SubscriptionSyncValidationError(
			'unsupported_status',
			'Unsupported Mollie subscription status: unexpected'
		);

		const result = classifySubscriptionSyncError(error);

		expect(result).toMatchObject({
			kind: 'permanent',
			code: 'unsupported_status',
			retryable: false
		});
	});
});
