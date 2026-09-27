import { dev } from '$app/environment';
import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { Resend } from 'resend';

import { CONTACT_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL } from '$env/static/private';

import type { Actions, PageServerLoad } from './$types';
import { engagementSchema } from '$lib/schemas/engagement';

/*
 * Client Resend.
 *
 * RESEND_API_KEY reste exclusivement côté serveur grâce à
 * $env/static/private.
 */
const resend = new Resend(RESEND_API_KEY);

/*
 * Temps minimal entre l'affichage du formulaire et sa soumission.
 *
 * Une soumission effectuée en moins de 3 secondes est considérée
 * comme probablement automatisée.
 */
const MIN_SUBMISSION_TIME_MS = 3_000;

/*
 * Nom du cookie utilisé pour mémoriser le moment auquel
 * le formulaire a été affiché.
 */
const FORM_TIMESTAMP_COOKIE = 'engagement_form_timestamp';

/*
 * Durée de vie maximale du cookie : 1 heure.
 */
const FORM_TIMESTAMP_MAX_AGE = 60 * 60;

export const load: PageServerLoad = async ({ cookies }) => {
	/*
	 * On mémorise côté navigateur le moment auquel le formulaire
	 * a été généré.
	 *
	 * Le cookie est HttpOnly afin qu'il ne puisse pas être lu ou
	 * modifié par le JavaScript exécuté dans la page.
	 *
	 * En développement :
	 *   secure = false
	 *   -> fonctionne avec http://localhost
	 *
	 * En production :
	 *   secure = true
	 *   -> le cookie n'est transmis qu'en HTTPS.
	 */
	cookies.set(FORM_TIMESTAMP_COOKIE, Date.now().toString(), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: FORM_TIMESTAMP_MAX_AGE
	});

	return {
		engagementForm: await superValidate(zod4(engagementSchema))
	};
};

export const actions: Actions = {
	engagement: async ({ request, cookies }) => {
		/*
		 * On récupère explicitement le FormData.
		 *
		 * Cela permet de contrôler le honeypot avant de lancer
		 * la validation normale avec Superforms.
		 */
		const formData = await request.formData();

		/*
		 * =========================================================
		 * 1. HONEYPOT
		 * =========================================================
		 *
		 * Le champ "website" existe dans le formulaire HTML mais
		 * est placé hors de l'écran.
		 *
		 * Un utilisateur normal ne le remplira donc jamais.
		 *
		 * Certains robots remplissent automatiquement tous les
		 * champs qu'ils trouvent. Si "website" contient quelque
		 * chose, on considère donc la soumission comme suspecte.
		 */
		const website = formData.get('website');

		if (typeof website === 'string' && website.trim() !== '') {
			console.warn("Honeypot déclenché sur le formulaire d'engagement");

			/*
			 * On ne révèle pas au bot qu'il a été détecté.
			 * Il reçoit exactement le même message qu'après une
			 * soumission réussie.
			 */
			return fakeSuccess(formData);
		}

		/*
		 * =========================================================
		 * 2. CONTRÔLE DU TEMPS DE SOUMISSION
		 * =========================================================
		 *
		 * On récupère le timestamp créé lors du chargement de
		 * la page.
		 */
		const timestamp = cookies.get(FORM_TIMESTAMP_COOKIE);

		if (timestamp) {
			const displayedAt = Number(timestamp);

			/*
			 * On vérifie d'abord que le contenu du cookie
			 * représente bien un nombre valide.
			 */
			if (Number.isFinite(displayedAt)) {
				const elapsedTime = Date.now() - displayedAt;

				/*
				 * Une soumission extrêmement rapide est
				 * probablement automatisée.
				 */
				if (elapsedTime < MIN_SUBMISSION_TIME_MS) {
					console.warn(`Soumission trop rapide du formulaire d'engagement : ${elapsedTime} ms`);

					/*
					 * Là encore, on simule une réussite afin de ne
					 * pas révéler le mécanisme anti-spam.
					 */
					return fakeSuccess(formData);
				}
			}
		}

		/*
		 * =========================================================
		 * 3. VALIDATION DU FORMULAIRE
		 * =========================================================
		 */
		const form = await superValidate(formData, zod4(engagementSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		const { name, email, subject, message: userMessage } = form.data;

		/*
		 * =========================================================
		 * 4. ENVOI DU MAIL AVEC RESEND
		 * =========================================================
		 */
		try {
			const { error } = await resend.emails.send({
				/*
				 * Cette adresse doit appartenir à un domaine
				 * configuré dans Resend.
				 */
				from: `FEMAPE Initiative <${RESEND_FROM_EMAIL}>`,

				/*
				 * Adresse de contact de FEMAPE.
				 */
				to: [CONTACT_EMAIL],

				/*
				 * Le mail est envoyé par FEMAPE mais un clic sur
				 * "Répondre" dans le client mail répond directement
				 * à la personne ayant rempli le formulaire.
				 */
				replyTo: email,

				subject: `[Formulaire d'engagement] ${getSubjectLabel(subject)}`,

				text: [
					`Nouvelle demande reçue depuis le formulaire d'engagement FEMAPE Initiative.`,
					``,
					`Nom : ${name}`,
					`Email : ${email}`,
					`Sujet : ${getSubjectLabel(subject)}`,
					``,
					`Message :`,
					userMessage
				].join('\n')
			});

			/*
			 * Le SDK Resend peut retourner une erreur dans son
			 * résultat sans nécessairement lever d'exception.
			 */
			if (error) {
				console.error("Erreur Resend lors de l'envoi du formulaire d'engagement :", error);

				return message(form, 'engagement_send_error', {
					status: 500
				});
			}
		} catch (error) {
			/*
			 * Gestion notamment des erreurs réseau ou des erreurs
			 * inattendues lors de l'appel à Resend.
			 */
			console.error("Erreur inattendue lors de l'envoi du formulaire d'engagement :", error);

			return message(form, 'engagement_send_error', {
				status: 500
			});
		}

		/*
		 * =========================================================
		 * 5. SUCCÈS
		 * =========================================================
		 *
		 * Le mail a été envoyé : le timestamp ayant servi au
		 * contrôle anti-spam n'est plus nécessaire.
		 */
		cookies.delete(FORM_TIMESTAMP_COOKIE, {
			path: '/'
		});

		/*
		 * La clé est traduite côté client avec Paraglide.
		 *
		 * Grâce à resetForm: true dans ton composant, le formulaire
		 * sera également réinitialisé après cette réussite.
		 */
		return message(form, 'engagement_success');
	}
};

/**
 * Retourne une fausse réponse positive lorsqu'une soumission
 * probablement automatisée est détectée.
 *
 * L'objectif est de ne donner aucune indication au bot sur
 * l'existence ou le fonctionnement de la protection anti-spam.
 */
async function fakeSuccess(formData: FormData) {
	const form = await superValidate(formData, zod4(engagementSchema));

	return message(form, 'engagement_success');
}

/**
 * Transforme la valeur technique du champ "subject" en libellé
 * compréhensible dans le mail reçu par FEMAPE.
 */
function getSubjectLabel(subject: string): string {
	switch (subject) {
		case 'volunteer':
			return 'Devenir bénévole';

		case 'partnership':
			return 'Proposer un partenariat';

		case 'information':
			return "Demande d'information";

		case 'other':
			return 'Autre demande';

		default:
			return subject;
	}
}
