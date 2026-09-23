import { fail } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';

import type { Actions, PageServerLoad } from './$types';
import { engagementSchema } from '$lib/schemas/engagement';

export const load: PageServerLoad = async () => {
	return {
		engagementForm: await superValidate(zod4(engagementSchema))
	};
};

export const actions: Actions = {
	engagement: async ({ request }) => {
		const form = await superValidate(request, zod4(engagementSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		/*
		 * Ici :
		 *
		 * form.data.name
		 * form.data.email
		 * form.data.subject
		 * form.data.message
		 * form.data.consent
		 *
		 * Tu peux enregistrer la demande en BDD
		 * et/ou envoyer un e-mail.
		 */

		return message(form, 'Votre message a bien été envoyé.');
	}
};
