import { and, count, eq, max, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { donationPayments, donations, donors } from '$lib/server/db/schema';

import type { DonationPaymentStatus } from './types';

/* ==============================================================
 * TYPES
 * ============================================================== */

export type UpdateDonationPaymentStatusData = {
	status: DonationPaymentStatus;

	/**
	 * Moyen de paiement réellement retourné par Mollie.
	 *
	 * Exemples :
	 * - creditcard
	 * - directdebit
	 * - ideal
	 * - paypal
	 *
	 * undefined :
	 *   ne modifie pas la valeur existante.
	 *
	 * null :
	 *   remet explicitement la valeur à NULL.
	 */
	molliePaymentMethod?: string | null;

	paidAt?: Date | null;
	failedAt?: Date | null;
	refundedAt?: Date | null;
};

export type CreateRecurringDonationPaymentData = {
	donationId: string;

	molliePaymentId: string;

	mollieCreatedAt: Date;

	/**
	 * Moyen de paiement réellement utilisé
	 * pour cette échéance.
	 */
	molliePaymentMethod?: string | null;

	amount: number;

	status: DonationPaymentStatus;

	paidAt?: Date | null;
	failedAt?: Date | null;
};

/* ==============================================================
 * CRÉATION DU PREMIER PAIEMENT
 * ============================================================== */

export async function createInitialDonationPayment(
	donationId: string,
	donorId: string,
	amount: number
) {
	const donor = await db.query.donors.findFirst({
		where: eq(donors.id, donorId)
	});

	if (!donor) {
		throw new Error(`Donor not found: ${donorId}`);
	}

	const [payment] = await db
		.insert(donationPayments)
		.values({
			donationId,

			sequenceNumber: 1,

			amount,

			status: 'pending',

			/*
			 * La méthode Mollie est volontairement
			 * absente ici.
			 *
			 * À ce stade, le paiement Mollie n'a pas
			 * encore été effectué et nous ne connaissons
			 * donc pas le moyen réellement utilisé.
			 */

			donorFirstName: donor.firstName,

			donorLastName: donor.lastName,

			donorEmail: donor.email,

			donorAddress: donor.address,

			donorPostalCode: donor.postalCode,

			donorCity: donor.city,

			donorCountry: donor.country
		})
		.returning();

	if (!payment) {
		throw new Error('Unable to create initial donation payment');
	}

	return payment;
}

/* ==============================================================
 * ASSOCIATION DU PREMIER PAIEMENT AVEC MOLLIE
 * ============================================================== */

export async function setDonationPaymentMollieData(
	paymentId: string,
	data: {
		molliePaymentId: string;
		mollieCreatedAt: Date;
	}
) {
	const [payment] = await db
		.update(donationPayments)
		.set({
			molliePaymentId: data.molliePaymentId,

			mollieCreatedAt: data.mollieCreatedAt
		})
		.where(eq(donationPayments.id, paymentId))
		.returning();

	if (!payment) {
		throw new Error(`Unable to set Mollie data for donation payment ${paymentId}`);
	}

	return payment;
}

/* ==============================================================
 * RECHERCHE PAR ID MOLLIE
 * ============================================================== */

export async function getDonationPaymentByMollieId(
	molliePaymentId: string
): Promise<typeof donationPayments.$inferSelect | null> {
	const [payment] = await db
		.select()
		.from(donationPayments)
		.where(eq(donationPayments.molliePaymentId, molliePaymentId))
		.limit(1);

	return payment ?? null;
}

/* ==============================================================
 * MISE À JOUR DU STATUT ET DES DONNÉES MOLLIE
 * ============================================================== */

export async function updateDonationPaymentStatus(
	paymentId: string,
	data: UpdateDonationPaymentStatusData
) {
	const [payment] = await db
		.update(donationPayments)
		.set({
			status: data.status,

			/*
			 * La méthode est mise à jour même lorsque
			 * le statut du Payment n'a pas changé.
			 *
			 * Cela permet notamment à un retry du webhook
			 * de compléter un Payment déjà "paid".
			 */
			...(data.molliePaymentMethod !== undefined
				? {
						molliePaymentMethod: data.molliePaymentMethod
					}
				: {}),

			...(data.paidAt !== undefined
				? {
						paidAt: data.paidAt
					}
				: {}),

			...(data.failedAt !== undefined
				? {
						failedAt: data.failedAt
					}
				: {}),

			...(data.refundedAt !== undefined
				? {
						refundedAt: data.refundedAt
					}
				: {})
		})
		.where(eq(donationPayments.id, paymentId))
		.returning();

	if (!payment) {
		throw new Error(`Unable to update donation payment ${paymentId}`);
	}

	return payment;
}

/* ==============================================================
 * CRÉATION D'UNE ÉCHÉANCE RÉCURRENTE
 * ============================================================== */

export async function createRecurringDonationPayment(data: CreateRecurringDonationPaymentData) {
	return db.transaction(async (tx) => {
		/*
		 * Les webhooks d'une même donation sont sérialisés.
		 *
		 * Cela empêche deux transactions de calculer le même
		 * sequenceNumber simultanément.
		 */
		await tx.execute(sql`
				SELECT id
				FROM ${donations}
				WHERE id = ${data.donationId}
				FOR UPDATE
			`);

		/*
		 * Vérification après acquisition du verrou.
		 *
		 * Un autre webhook a pu créer le paiement pendant
		 * que cette transaction attendait.
		 */
		const [existingPayment] = await tx
			.select()
			.from(donationPayments)
			.where(eq(donationPayments.molliePaymentId, data.molliePaymentId))
			.limit(1);

		if (existingPayment) {
			/*
			 * Le webhook est idempotent.
			 *
			 * Si l'échéance existe déjà, sa mise à jour
			 * éventuelle sera effectuée ensuite par
			 * updateDonationPaymentStatus().
			 */
			return existingPayment;
		}

		const [donation] = await tx
			.select()
			.from(donations)
			.where(eq(donations.id, data.donationId))
			.limit(1);

		if (!donation) {
			throw new Error(`Donation not found: ${data.donationId}`);
		}

		if (donation.type !== 'recurring') {
			throw new Error(`Donation ${donation.id} is not recurring`);
		}

		const [donor] = await tx.select().from(donors).where(eq(donors.id, donation.donorId)).limit(1);

		if (!donor) {
			throw new Error(`Donor not found: ${donation.donorId}`);
		}

		/*
		 * Déterminer le numéro de la nouvelle échéance.
		 */
		const [sequence] = await tx
			.select({
				maxSequenceNumber: max(donationPayments.sequenceNumber)
			})
			.from(donationPayments)
			.where(eq(donationPayments.donationId, donation.id));

		const sequenceNumber = (sequence?.maxSequenceNumber ?? 0) + 1;

		/*
		 * Création de l'échéance.
		 *
		 * La méthode réellement retournée par Mollie
		 * est enregistrée sur cette échéance.
		 */
		const [payment] = await tx
			.insert(donationPayments)
			.values({
				donationId: donation.id,

				sequenceNumber,

				amount: data.amount,

				status: data.status,

				molliePaymentId: data.molliePaymentId,

				mollieCreatedAt: data.mollieCreatedAt,

				molliePaymentMethod: data.molliePaymentMethod ?? null,

				paidAt: data.paidAt ?? null,

				failedAt: data.failedAt ?? null,

				donorFirstName: donor.firstName,

				donorLastName: donor.lastName,

				donorEmail: donor.email,

				donorAddress: donor.address,

				donorPostalCode: donor.postalCode,

				donorCity: donor.city,

				donorCountry: donor.country
			})
			.returning();

		if (!payment) {
			throw new Error('Unable to create recurring donation payment');
		}

		return payment;
	});
}

/* ==============================================================
 * NOMBRE DE PAIEMENTS EFFECTIVEMENT PAYÉS
 * ============================================================== */

export async function countPaidDonationPayments(donationId: string) {
	const [result] = await db
		.select({
			count: count()
		})
		.from(donationPayments)
		.where(
			and(
				eq(donationPayments.donationId, donationId),

				eq(donationPayments.status, 'paid')
			)
		);

	return result?.count ?? 0;
}

/**
 * Enregistre la date d'un remboursement intégral confirmé.
 *
 * Ne modifie pas le statut initial du paiement.
 * La date existante est conservée en cas de nouvel appel.
 *
 * Fonction idempotente.
 */
export async function markDonationPaymentRefunded(
	paymentId: string,
	refundedAt: Date = new Date()
) {
	const [payment] = await db
		.update(donationPayments)
		.set({
			refundedAt: sql<Date>`
				COALESCE(
					${donationPayments.refundedAt},
					${sql.param(refundedAt, donationPayments.refundedAt)}
				)
			`
		})
		.where(eq(donationPayments.id, paymentId))
		.returning();

	if (!payment) {
		throw new Error(`Donation payment ${paymentId} not found.`);
	}

	return payment;
}

/**
 * Récupère le premier paiement encaissé d'un don.
 *
 * La date paidAt servira de référence pour calculer
 * la première échéance de la souscription Mollie.
 */
export async function getFirstPaidDonationPayment(
	donationId: string
): Promise<{ id: string; paidAt: Date | null } | null> {
	const [payment] = await db
		.select({
			id: donationPayments.id,
			paidAt: donationPayments.paidAt
		})
		.from(donationPayments)
		.where(
			and(
				eq(donationPayments.donationId, donationId),
				eq(donationPayments.sequenceNumber, 1),
				eq(donationPayments.status, 'paid')
			)
		)
		.limit(1);

	return payment ?? null;
}
