import { z } from 'zod';

/**
 * Type de don.
 */
export const donationTypeSchema = z.enum(['one-off', 'recurring']);

/**
 * Fréquence d'un don récurrent.
 */
export const recurringFrequencySchema = z.enum(['monthly', 'quarterly']);

/**
 * Durée d'un don récurrent.
 *
 * unlimited :
 *   jusqu'à annulation par le donateur.
 *
 * fixed :
 *   nombre total de paiements défini.
 */
export const recurringDurationSchema = z.enum(['unlimited', 'fixed']);

/**
 * Moyen de paiement sélectionné sur FEMAPE.
 *
 * "sepa" sera traduit en "directdebit"
 * lors de l'appel à l'API Mollie.
 */
export const paymentMethodSchema = z.enum(['card', 'sepa']);

export const donationSchema = z
	.object({
		/*
		 * ============================================================
		 * DON
		 * ============================================================
		 */

		donationType: donationTypeSchema,

		/**
		 * Montant exprimé en euros.
		 *
		 * Le minimum autorisé par FEMAPE est de 2 €.
		 * La conversion en centimes sera effectuée côté serveur
		 * avant les opérations financières.
		 */
		amount: z.coerce
			.number({
				error: 'amount_invalid'
			})
			.min(2, {
				error: 'amount_too_low'
			})
			.max(100_000, {
				error: 'amount_too_high'
			}),

		/*
		 * ============================================================
		 * DON RÉCURRENT
		 * ============================================================
		 */

		frequency: recurringFrequencySchema.optional(),

		duration: recurringDurationSchema.optional(),

		/**
		 * Nombre TOTAL de paiements souhaité.
		 *
		 * Exemple :
		 *
		 * amount       = 10
		 * frequency    = monthly
		 * paymentCount = 3
		 *
		 * signifie 3 paiements de 10 €, et non pas
		 * le premier paiement + 3 paiements.
		 */
		paymentCount: z.coerce
			.number({
				error: 'payment_count_invalid'
			})
			.int({
				error: 'payment_count_invalid'
			})
			.min(2, {
				error: 'payment_count_too_low'
			})
			.optional(),

		/*
		 * ============================================================
		 * PAIEMENT
		 * ============================================================
		 */

		paymentMethod: paymentMethodSchema,

		/*
		 * ============================================================
		 * DONATEUR
		 * ============================================================
		 */

		firstName: z
			.string()
			.trim()
			.min(2, {
				error: 'first_name_too_short'
			})
			.max(100, {
				error: 'first_name_too_long'
			}),

		lastName: z
			.string()
			.trim()
			.min(2, {
				error: 'last_name_too_short'
			})
			.max(100, {
				error: 'last_name_too_long'
			}),

		email: z
			.email({
				error: 'email_invalid'
			})
			.max(254, {
				error: 'email_too_long'
			}),

		address: z
			.string()
			.trim()
			.min(3, {
				error: 'address_too_short'
			})
			.max(200, {
				error: 'address_too_long'
			}),

		postalCode: z
			.string()
			.trim()
			.min(2, {
				error: 'postal_code_invalid'
			})
			.max(20, {
				error: 'postal_code_invalid'
			}),

		city: z
			.string()
			.trim()
			.min(2, {
				error: 'city_too_short'
			})
			.max(100, {
				error: 'city_too_long'
			}),

		/**
		 * Code pays ISO 3166-1 alpha-2.
		 *
		 * On ne limite volontairement pas le schéma aux pays
		 * actuellement affichés dans le select.
		 */
		country: z
			.string()
			.trim()
			.length(2, {
				error: 'country_invalid'
			})
			.transform((value) => value.toUpperCase()),

		/*
		 * ============================================================
		 * ANTI-SPAM
		 * ============================================================
		 */

		/**
		 * Honeypot.
		 * Ce champ doit rester vide pour un utilisateur réel.
		 */
		website: z
			.string()
			.max(0, {
				error: 'spam_detected'
			})
			.optional()
			.default(''),

		/**
		 * Timestamp injecté à l'affichage du formulaire.
		 * Il permettra de rejeter les soumissions anormalement rapides.
		 */
		formStartedAt: z.coerce
			.number({
				error: 'form_started_at_invalid'
			})
			.int()
			.positive()
	})
	.superRefine((data, ctx) => {
		/*
		 * ============================================================
		 * DON UNIQUE
		 * ============================================================
		 *
		 * Les paramètres de récurrence ne doivent pas être utilisés.
		 */

		if (data.donationType === 'one-off') {
			return;
		}

		/*
		 * ============================================================
		 * DON RÉCURRENT
		 * ============================================================
		 */

		if (!data.frequency) {
			ctx.addIssue({
				code: 'custom',
				path: ['frequency'],
				message: 'frequency_required'
			});
		}

		if (!data.duration) {
			ctx.addIssue({
				code: 'custom',
				path: ['duration'],
				message: 'duration_required'
			});

			return;
		}

		/*
		 * Une durée fixe exige un nombre de paiements.
		 */
		if (data.duration === 'fixed' && data.paymentCount === undefined) {
			ctx.addIssue({
				code: 'custom',
				path: ['paymentCount'],
				message: 'payment_count_required'
			});
		}
	});

export type DonationSchema = z.infer<typeof donationSchema>;

export type DonationFormData = z.infer<typeof donationSchema>;

export type DonationType = z.infer<typeof donationTypeSchema>;

export type RecurringFrequency = z.infer<typeof recurringFrequencySchema>;

export type RecurringDuration = z.infer<typeof recurringDurationSchema>;

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
