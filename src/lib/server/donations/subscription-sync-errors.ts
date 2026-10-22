export type SubscriptionSyncErrorKind = 'transient' | 'permanent' | 'configuration';

export type SubscriptionSyncErrorCode =
	| 'network_error'
	| 'rate_limited'
	| 'server_error'
	| 'unauthorized'
	| 'forbidden'
	| 'not_found'
	| 'invalid_metadata'
	| 'unsupported_status'
	| 'unknown';

export type SubscriptionSyncErrorClassification = {
	kind: SubscriptionSyncErrorKind;
	code: SubscriptionSyncErrorCode;
	retryable: boolean;
	message: string;
	httpStatus: number | null;
};

function getHttpStatus(error: unknown): number | null {
	if (typeof error !== 'object' || error === null) {
		return null;
	}

	const candidate = error as {
		status?: unknown;
		statusCode?: unknown;
		response?: {
			status?: unknown;
		};
	};

	const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status;

	return typeof status === 'number' && Number.isInteger(status) ? status : null;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

export function classifySubscriptionSyncError(error: unknown): SubscriptionSyncErrorClassification {
	const httpStatus = getHttpStatus(error);
	const message = getErrorMessage(error);

	if (httpStatus === 429) {
		return {
			kind: 'transient',
			code: 'rate_limited',
			retryable: true,
			message,
			httpStatus
		};
	}

	if (httpStatus !== null && httpStatus >= 500) {
		return {
			kind: 'transient',
			code: 'server_error',
			retryable: true,
			message,
			httpStatus
		};
	}

	if (httpStatus === 401 || httpStatus === 403) {
		return {
			kind: 'configuration',
			code: httpStatus === 401 ? 'unauthorized' : 'forbidden',
			retryable: false,
			message,
			httpStatus
		};
	}

	if (httpStatus === 404) {
		return {
			kind: 'permanent',
			code: 'not_found',
			retryable: false,
			message,
			httpStatus
		};
	}

	if (error instanceof SubscriptionSyncValidationError) {
		return {
			kind: 'permanent',
			code: error.code,
			retryable: false,
			message,
			httpStatus: null
		};
	}

	if (
		error instanceof Error &&
		(error.name === 'AbortError' ||
			error.name === 'TimeoutError' ||
			('code' in error &&
				typeof error.code === 'string' &&
				['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND'].includes(error.code)))
	) {
		return {
			kind: 'transient',
			code: 'network_error',
			retryable: true,
			message,
			httpStatus
		};
	}

	return {
		kind: 'permanent',
		code: 'unknown',
		retryable: false,
		message,
		httpStatus
	};
}

export class SubscriptionSyncValidationError extends Error {
	constructor(
		public readonly code: 'invalid_metadata' | 'unsupported_status',
		message: string
	) {
		super(message);
		this.name = 'SubscriptionSyncValidationError';
	}
}
