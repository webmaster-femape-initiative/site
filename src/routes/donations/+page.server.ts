import { fail, redirect } from '@sveltejs/kit';

import { message, superValidate } from 'sveltekit-superforms';

import { zod4 } from 'sveltekit-superforms/adapters';

import { donationSchema } from '$lib/schemas/donation';

import { getLocale, localizeHref } from '$lib/paraglide/runtime';

import { createDonationRequest } from '$lib/server/donations/create-donation';

import { setDonorMollieCustomerId } from '$lib/server/donations/donors';

import { setDonationPaymentMollieData } from '$lib/server/donations/payments';

import { createMollieCustomer } from '$lib/server/mollie/customers';

import { createMolliePayment } from '$lib/server/mollie/payments';

import type { Actions, PageServerLoad } from './$types';

/*
 * Temps minimal entre l'affichage du formulaire
 * et sa soumission.
 *
 * Un humain ne peut raisonnablement pas remplir
 * le formulaire en moins de 2 secondes.
 */
const MIN_SUBMISSION_TIME = 2_000;

/*
 * Durée maximale pendant laquelle nous considérons
 * le timestamp du formulaire comme raisonnable.
 */
const MAX_FORM_AGE = 24 * 60 * 60 * 1_000;

/* ============================================================
 * LOAD
 * ============================================================
 */

export const load: PageServerLoad = async () => {
	const donationForm = await superValidate(
		{
			donationType: 'one-off' as const,

			amount: 25,

			frequency: 'monthly' as const,

			duration: 'unlimited' as const,

			paymentCount: 3,

			paymentMethod: 'card' as const,

			firstName: '',
			lastName: '',
			email: '',
			address: '',
			postalCode: '',
			city: '',
			country: 'FR',

			website: '',
			formStartedAt: Date.now()
		},
		zod4(donationSchema),
		{
			errors: false
		}
	);

	return {
		donationForm
	};
};

/* ============================================================
 * ACTIONS
 * ============================================================
 */

export const actions: Actions = {
	donation: async ({ request, url }) => {
		const form = await superValidate(request, zod4(donationSchema));

		/* ========================================================
		 * VALIDATION ZOD / SUPERFORMS
		 * ========================================================
		 */

		if (!form.valid) {
			return fail(400, {
				donationForm: form
			});
		}

		/* ========================================================
		 * HONEYPOT
		 * ========================================================
		 */

		if (form.data.website) {
			return fail(400, {
				donationForm: form
			});
		}

		/* ========================================================
		 * CONTRÔLE DU TEMPS DE SOUMISSION
		 * ========================================================
		 */

		const now = Date.now();

		const elapsed = now - form.data.formStartedAt;

		if (elapsed < MIN_SUBMISSION_TIME || elapsed > MAX_FORM_AGE) {
			return message(
				form,
				{
					status: 'error',
					code: 'submission_rejected'
				},
				{
					status: 400
				}
			);
		}

		/* ========================================================
		 * NORMALISATION
		 * ========================================================
		 */

		/*
		 * Le formulaire exprime le montant
		 * en euros.
		 *
		 * PostgreSQL et notre domaine
		 * travaillent en centimes.
		 */
		const amountInCents = Math.round(form.data.amount * 100);

		const donation = {
			type: form.data.donationType,

			amount: amountInCents,

			paymentMethod: form.data.paymentMethod,

			frequency: form.data.donationType === 'recurring' ? form.data.frequency! : null,

			duration: form.data.donationType === 'recurring' ? form.data.duration! : null,

			paymentCount:
				form.data.donationType === 'recurring' && form.data.duration === 'fixed'
					? form.data.paymentCount!
					: null
		};

		const donor = {
			firstName: form.data.firstName.trim(),

			lastName: form.data.lastName.trim(),

			email: form.data.email.trim().toLowerCase(),

			address: form.data.address.trim(),

			postalCode: form.data.postalCode.trim(),

			city: form.data.city.trim(),

			country: form.data.country.trim().toUpperCase()
		};

		/* ========================================================
		 * CRÉATION DU DON
		 * ========================================================
		 */

		let created;

		try {
			created = await createDonationRequest({
				...donor,
				...donation
			});
		} catch (error) {
			console.error('Unable to create donation:', error);

			return message(
				form,
				{
					status: 'error',
					code: 'donation_creation_failed'
				},
				{
					status: 500
				}
			);
		}

		const { donor: createdDonor, donation: createdDonation, payment: createdPayment } = created;

		/* ========================================================
		 * CUSTOMER MOLLIE
		 * ========================================================
		 *
		 * Un Customer Mollie n'est nécessaire
		 * que pour les dons récurrents.
		 */

		let mollieCustomerId: string | undefined;

		if (createdDonation.type === 'recurring') {
			try {
				const mollieCustomer = await createMollieCustomer({
					firstName: createdDonor.firstName,

					lastName: createdDonor.lastName,

					email: createdDonor.email,

					donorId: createdDonor.id,

					donorNumber: createdDonor.donorNumber
				});

				mollieCustomerId = mollieCustomer.id;

				await setDonorMollieCustomerId(createdDonor.id, mollieCustomer.id);
			} catch (error) {
				console.error('Unable to create Mollie customer:', error);

				return message(
					form,
					{
						status: 'error',
						code: 'payment_initialization_failed'
					},
					{
						status: 502
					}
				);
			}
		}

		/* ========================================================
		 * URL DE RETOUR LOCALISÉE
		 * ========================================================
		 *
		 * Mollie doit renvoyer le navigateur dans
		 * la langue depuis laquelle le don a été effectué.
		 *
		 * Exemples :
		 *
		 * /fr/donations
		 *     -> /fr/donations/confirmation
		 *
		 * /en/donations
		 *     -> /en/donations/confirmation
		 */

		const locale = getLocale();

		const confirmationPath = localizeHref('/donations/confirmation', {
			locale
		});

		const mollieRedirectUrl = new URL(confirmationPath, url.origin).toString();

		/* ========================================================
		 * PAIEMENT MOLLIE
		 * ========================================================
		 */

		let molliePayment;

		try {
			molliePayment = await createMolliePayment({
				donationId: createdDonation.id,

				paymentId: createdPayment.id,

				amount: createdPayment.amount,

				type: createdDonation.type,

				customerId: mollieCustomerId,

				redirectUrl: mollieRedirectUrl
			});
		} catch (error) {
			console.error('Unable to create Mollie payment:', error);

			return message(
				form,
				{
					status: 'error',
					code: 'payment_initialization_failed'
				},
				{
					status: 502
				}
			);
		}

		/* ========================================================
		 * ENREGISTREMENT DES INFORMATIONS MOLLIE
		 * ========================================================
		 *
		 * createdPayment.id :
		 * UUID PostgreSQL du donation_payment.
		 *
		 * molliePayment.id :
		 * identifiant Mollie tr_...
		 * ========================================================
		 */

		try {
			await setDonationPaymentMollieData(createdPayment.id, {
				molliePaymentId: molliePayment.id,

				mollieCreatedAt: new Date(molliePayment.createdAt)
			});
		} catch (error) {
			console.error('Unable to save Mollie payment ID:', error);

			return message(
				form,
				{
					status: 'error',
					code: 'payment_initialization_failed'
				},
				{
					status: 500
				}
			);
		}

		/* ========================================================
		 * CHECKOUT
		 * ========================================================
		 */

		const checkoutUrl = molliePayment.links.checkout?.href;

		if (!checkoutUrl) {
			console.error('Mollie payment has no checkout URL:', molliePayment.id);

			return message(
				form,
				{
					status: 'error',
					code: 'payment_initialization_failed'
				},
				{
					status: 502
				}
			);
		}

		redirect(303, checkoutUrl);
	}
};
