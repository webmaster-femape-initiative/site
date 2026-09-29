import { dev } from '$app/environment';
import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { Resend } from 'resend';

import type { Actions, PageServerLoad } from './$types';

import { contactSchema } from '$lib/schemas/contact';
import { RESEND_API_KEY, RESEND_FROM_EMAIL, CONTACT_EMAIL } from '$env/static/private';

/*
 * Durée minimale considérée comme crédible pour remplir le formulaire.
 *
 * Ce mécanisme n'est pas une protection absolue : le timestamp est envoyé
 * par le navigateur et peut donc être falsifié. Il constitue néanmoins
 * un filtre supplémentaire combiné au honeypot.
 */
const MIN_FORM_COMPLETION_TIME = 3_000;

/*
 * Une durée maximale évite d'accepter un timestamp manifestement incohérent.
 * Ici : 24 heures.
 */
const MAX_FORM_COMPLETION_TIME = 24 * 60 * 60 * 1_000;

const resend = dev ? null : new Resend(RESEND_API_KEY);

export const load: PageServerLoad = async () => {
	const form = await superValidate(zod4(contactSchema));

	return {
		form
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await superValidate(request, zod4(contactSchema));

		/*
		 * Validation Zod / Superforms.
		 */
		if (!form.valid) {
			return fail(400, {
				form
			});
		}

		const {
			lastName,
			firstName,
			email,
			subject,
			message: userMessage,
			website,
			formStartedAt
		} = form.data;

		/*
		 * ------------------------------------------------------------
		 * Protection anti-spam : honeypot
		 * ------------------------------------------------------------
		 *
		 * Un utilisateur normal ne peut pas voir ni remplir ce champ.
		 */
		if (website?.trim()) {
			console.warn('[contact] Spam détecté : honeypot rempli');

			/*
			 * On retourne volontairement un succès au bot.
			 * Cela évite de lui indiquer que son comportement a été détecté.
			 */
			return message(form, 'success');
		}

		/*
		 * ------------------------------------------------------------
		 * Protection anti-spam : temps de remplissage
		 * ------------------------------------------------------------
		 */
		const now = Date.now();
		const completionTime = now - formStartedAt;

		if (
			!Number.isFinite(completionTime) ||
			completionTime < MIN_FORM_COMPLETION_TIME ||
			completionTime > MAX_FORM_COMPLETION_TIME
		) {
			console.warn(`[contact] Soumission suspecte : durée=${completionTime}ms`);

			/*
			 * Même principe que pour le honeypot :
			 * ne pas révéler au bot qu'il a été détecté.
			 */
			return message(form, 'success');
		}

		/*
		 * ------------------------------------------------------------
		 * Environnement de développement
		 * ------------------------------------------------------------
		 *
		 * Aucun e-mail n'est envoyé afin d'éviter de consommer des
		 * envois Resend pendant le développement.
		 */
		if (dev) {
			console.log('----------------------------------------');
			console.log('[contact] Formulaire reçu en DEV');
			console.log('----------------------------------------');
			console.log('Nom       :', lastName);
			console.log('Prénom    :', firstName);
			console.log('Email     :', email);
			console.log('Objet     :', subject);
			console.log('Message   :', userMessage);
			console.log('Durée     :', `${completionTime} ms`);
			console.log('----------------------------------------');

			return message(form, 'success');
		}

		/*
		 * ------------------------------------------------------------
		 * Envoi avec Resend
		 * ------------------------------------------------------------
		 */
		try {
			if (!resend) {
				throw new Error('Resend non initialisé');
			}

			const subjectLabels: Record<typeof subject, string> = {
				information: "Demande d'information",
				volunteering: 'Bénévolat',
				donation: 'Don',
				partnership: 'Partenariat',
				press: 'Presse / média',
				other: 'Autre'
			};

			const subjectLabel = subjectLabels[subject];

			const { error } = await resend.emails.send({
				from: RESEND_FROM_EMAIL,

				to: CONTACT_EMAIL,

				/*
				 * Très important :
				 *
				 * on n'utilise pas l'adresse du visiteur dans "from".
				 * L'expéditeur doit appartenir au domaine vérifié auprès
				 * de Resend.
				 *
				 * replyTo permet en revanche de répondre directement
				 * au visiteur depuis le client mail.
				 */
				replyTo: email,

				subject: `[FEMAPE Initiative] ${subjectLabel}`,

				text: [
					'Nouveau message envoyé depuis le formulaire de contact',
					'',
					`Nom : ${lastName}`,
					`Prénom : ${firstName}`,
					`E-mail : ${email}`,
					`Objet : ${subjectLabel}`,
					'',
					'Message :',
					userMessage
				].join('\n'),

				html: `
					<h2>Nouveau message depuis le site FEMAPE Initiative</h2>

					<p>
						<strong>Nom :</strong>
						${escapeHtml(lastName)}
					</p>

					<p>
						<strong>Prénom :</strong>
						${escapeHtml(firstName)}
					</p>

					<p>
						<strong>E-mail :</strong>
						${escapeHtml(email)}
					</p>

					<p>
						<strong>Objet :</strong>
						${escapeHtml(subjectLabel)}
					</p>

					<hr>

					<p>
						<strong>Message :</strong>
					</p>

					<p>
						${escapeHtml(userMessage).replace(/\n/g, '<br>')}
					</p>
				`
			});

			if (error) {
				console.error('[contact] Erreur Resend :', error);

				return message(form, 'error', {
					status: 500
				});
			}

			return message(form, 'success');
		} catch (error) {
			console.error('[contact] Erreur lors de l’envoi du message :', error);

			return message(form, 'error', {
				status: 500
			});
		}
	}
};

/*
 * Les valeurs saisies par l'utilisateur ne doivent jamais être injectées
 * directement dans le HTML de l'e-mail.
 */
function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}
