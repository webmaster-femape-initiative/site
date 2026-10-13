import { dev } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';

import { mollie } from '$lib/server/mollie/client';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	/*
	 * Cette route ne doit jamais être disponible
	 * en production.
	 */
	if (!dev) {
		throw error(404);
	}

	const { paymentId } = params;

	if (!/^tr_[a-zA-Z0-9]+$/.test(paymentId)) {
		throw error(400, 'Invalid Mollie payment ID.');
	}

	/*
	 * Récupérer directement le paiement Mollie.
	 * Aucune souscription n'est nécessaire.
	 */
	const payment = await mollie.payments.get({
		paymentId
	});

	console.log('Mollie test payment:', {
		id: payment.id,
		status: payment.status,
		amount: payment.amount,
		sequenceType: payment.sequenceType
	});

	/*
	 * Mollie fournit éventuellement un lien permettant
	 * de modifier l'état du paiement en environnement test.
	 */
	const changePaymentState = payment.links?.changePaymentState?.href;

	if (!changePaymentState) {
		throw error(404, 'No changePaymentState URL is available for this payment.');
	}

	throw redirect(303, changePaymentState);
};
