import { randomUUID } from 'node:crypto';

import { and, eq, isNull, lte } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { donations } from '$lib/server/db/schema';

export type SubscriptionReservation = {
	donationId: string;
	token: string;
};

export async function reserveSubscriptionCreation(
	donationId: string
): Promise<SubscriptionReservation | null> {
	const token = randomUUID();
	const now = new Date();

	const [reserved] = await db
		.update(donations)
		.set({
			subscriptionCreationStatus: 'reserved',
			subscriptionCreationToken: token,
			subscriptionCreationReservedAt: now,
			subscriptionCreationUpdatedAt: now,
			updatedAt: now
		})
		.where(
			and(
				eq(donations.id, donationId),
				eq(donations.type, 'recurring'),
				eq(donations.subscriptionCreationStatus, 'idle'),
				isNull(donations.mollieSubscriptionId)
			)
		)
		.returning({ id: donations.id });

	if (!reserved) {
		return null;
	}

	return { donationId: reserved.id, token };
}

/**
 * Marque une tentative dont le résultat doit être rapproché
 * avec Mollie avant toute éventuelle nouvelle création.
 *
 * Cette opération est également utilisée lorsqu'un abonnement
 * a été créé, mais n'a pas encore été enregistré dans donations.
 */
export async function markSubscriptionReconciliationRequired(
	reservation: SubscriptionReservation
): Promise<boolean> {
	const now = new Date();

	const [updated] = await db
		.update(donations)
		.set({
			subscriptionCreationStatus: 'reconciliation_required',
			subscriptionCreationToken: null,
			subscriptionCreationReservedAt: null,
			subscriptionCreationUpdatedAt: now,
			updatedAt: now
		})
		.where(
			and(
				eq(donations.id, reservation.donationId),
				eq(donations.subscriptionCreationStatus, 'reserved'),
				eq(donations.subscriptionCreationToken, reservation.token)
			)
		)
		.returning({ id: donations.id });

	return updated !== undefined;
}

/**
 * Active un abonnement Mollie uniquement si le traitement
 * possède toujours la réservation PostgreSQL.
 *
 * Retourne true si l'activation a été effectuée.
 * Retourne false si la réservation n'est plus valide.
 */

export async function activateReservedSubscription(
	reservation: SubscriptionReservation,
	mollieSubscriptionId: string,
	mollieStatus: 'active' | 'pending'
): Promise<boolean> {
	if (!mollieSubscriptionId.trim()) {
		throw new Error('Mollie subscription ID is required');
	}

	const now = new Date();

	const [updated] = await db
		.update(donations)
		.set({
			mollieSubscriptionId,
			subscriptionCreationStatus: 'activated',
			subscriptionCreationToken: null,
			subscriptionCreationReservedAt: null,
			subscriptionCreationUpdatedAt: now,
			status: mollieStatus === 'active' ? 'active' : 'pending',
			updatedAt: now
		})
		.where(
			and(
				eq(donations.id, reservation.donationId),
				eq(donations.type, 'recurring'),
				eq(donations.subscriptionCreationStatus, 'reserved'),
				eq(donations.subscriptionCreationToken, reservation.token),
				isNull(donations.mollieSubscriptionId)
			)
		)
		.returning({
			id: donations.id
		});

	return updated !== undefined;
}

/**
 * Enregistre un abonnement Mollie retrouvé après une tentative
 * de création dont l'issue était incertaine.
 *
 * Cette opération n'autorise jamais une nouvelle création Mollie.
 *
 * Retourne true si l'abonnement a été enregistré.
 * Retourne false si le don n'est pas dans un état récupérable.
 */

export async function recoverExistingSubscription(
	donationId: string,
	mollieSubscriptionId: string,
	mollieStatus: 'active' | 'pending'
): Promise<boolean> {
	if (!mollieSubscriptionId.trim()) {
		throw new Error('Mollie subscription ID is required');
	}

	const now = new Date();

	const [updated] = await db
		.update(donations)
		.set({
			mollieSubscriptionId,
			subscriptionCreationStatus: 'activated',
			subscriptionCreationToken: null,
			subscriptionCreationReservedAt: null,
			subscriptionCreationUpdatedAt: now,
			status: mollieStatus === 'active' ? 'active' : 'pending',
			updatedAt: now
		})
		.where(
			and(
				eq(donations.id, donationId),
				eq(donations.type, 'recurring'),
				eq(donations.subscriptionCreationStatus, 'reconciliation_required'),
				isNull(donations.mollieSubscriptionId)
			)
		)
		.returning({
			id: donations.id
		});

	return updated !== undefined;
}

/**
 * Délai au-delà duquel une réservation est considérée
 * comme potentiellement abandonnée.
 *
 * Une réservation expirée ne doit jamais être libérée
 * directement pour permettre une nouvelle création Mollie.
 */
export const SUBSCRIPTION_RESERVATION_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Place une réservation expirée en rapprochement.
 *
 * Cette fonction :
 * - ne contacte pas Mollie ;
 * - ne crée aucun abonnement ;
 * - ne réinitialise jamais la réservation à 'idle' ;
 * - ne modifie pas les réservations récentes ;
 * - ne modifie pas les abonnements déjà enregistrés.
 *
 * Retourne true uniquement si la transition a été effectuée.
 */
export async function reconcileStaleSubscriptionReservation(
	donationId: string,
	now: Date = new Date()
): Promise<boolean> {
	const cutoff = new Date(now.getTime() - SUBSCRIPTION_RESERVATION_TIMEOUT_MS);

	const [updated] = await db
		.update(donations)
		.set({
			subscriptionCreationStatus: 'reconciliation_required',
			subscriptionCreationToken: null,
			subscriptionCreationReservedAt: null,
			subscriptionCreationUpdatedAt: now,
			updatedAt: now
		})
		.where(
			and(
				eq(donations.id, donationId),
				eq(donations.type, 'recurring'),
				eq(donations.subscriptionCreationStatus, 'reserved'),
				lte(donations.subscriptionCreationReservedAt, cutoff),
				isNull(donations.mollieSubscriptionId)
			)
		)
		.returning({
			id: donations.id
		});

	return updated !== undefined;
}
