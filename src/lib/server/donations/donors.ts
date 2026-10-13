import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import { donors } from '$lib/server/db/schema';

import type { CreateDonorData } from './types';

export async function createDonor(data: CreateDonorData) {
	const [donor] = await db
		.insert(donors)
		.values({
			firstName: data.firstName.trim(),
			lastName: data.lastName.trim(),
			email: data.email.trim().toLowerCase(),
			address: data.address.trim(),
			postalCode: data.postalCode.trim(),
			city: data.city.trim(),
			country: data.country.trim().toUpperCase()
		})
		.returning();

	if (!donor) {
		throw new Error('Unable to create donor');
	}

	return donor;
}

export async function getDonorById(id: string) {
	const [donor] = await db.select().from(donors).where(eq(donors.id, id)).limit(1);

	return donor ?? null;
}

export async function setDonorMollieCustomerId(donorId: string, mollieCustomerId: string) {
	const [donor] = await db
		.update(donors)
		.set({
			mollieCustomerId,
			updatedAt: new Date()
		})
		.where(eq(donors.id, donorId))
		.returning();

	if (!donor) {
		throw new Error('Unable to update donor Mollie customer');
	}

	return donor;
}
