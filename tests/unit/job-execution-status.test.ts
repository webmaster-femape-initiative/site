import { describe, expect, it } from 'vitest';

import { getJobExecutionStatus } from '../../src/lib/server/jobs/execution-log';

describe('getJobExecutionStatus', () => {
	it.each([
		{
			description: 'all operations succeeded',
			successCount: 1,
			failureCount: 0,
			expected: 'completed'
		},
		{
			description: 'no operations failed or succeeded',
			successCount: 0,
			failureCount: 0,
			expected: 'completed'
		},
		{
			description: 'one operation failed',
			successCount: 0,
			failureCount: 1,
			expected: 'failed'
		},
		{
			description: 'all operations failed',
			successCount: 0,
			failureCount: 3,
			expected: 'failed'
		},
		{
			description: 'some operations succeeded and some failed',
			successCount: 2,
			failureCount: 1,
			expected: 'partial'
		},
		{
			description: 'one operation succeeded and multiple failed',
			successCount: 1,
			failureCount: 3,
			expected: 'partial'
		},
		{
			description: 'multiple operations succeeded',
			successCount: 5,
			failureCount: 0,
			expected: 'completed'
		}
	])('returns $expected when $description', ({ successCount, failureCount, expected }) => {
		const status = getJobExecutionStatus(successCount, failureCount);

		expect(status).toBe(expected);
	});
});
