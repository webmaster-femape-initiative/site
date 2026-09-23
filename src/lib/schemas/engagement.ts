import { z } from 'zod';

export const engagementSchema = z.object({
	name: z.string().trim().min(2, 'name_too_short').max(100, 'name_too_long'),

	email: z.string().trim().email('email_invalid'),

	subject: z.enum(['volunteer', 'partnership', 'information', 'other']),

	message: z.string().trim().min(10, 'message_too_short').max(2000, 'message_too_long'),

	consent: z.boolean().refine((value) => value, 'consent_required')
});

export type EngagementSchema = z.infer<typeof engagementSchema>;
