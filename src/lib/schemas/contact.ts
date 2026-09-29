import { z } from 'zod';

export const contactSchema = z.object({
	lastName: z.string().trim().min(2, 'last_name_too_short'),
	firstName: z.string().trim().min(2, 'first_name_too_short'),

	email: z.email('invalid_email'),

	subject: z.enum(['information', 'volunteering', 'donation', 'partnership', 'press', 'other']),

	message: z.string().trim().min(10, 'message_too_short'),

	// Anti-spam
	website: z.string().max(0, 'spam_detected').optional(),
	formStartedAt: z.coerce.number()
});

export type ContactSchema = z.infer<typeof contactSchema>;
