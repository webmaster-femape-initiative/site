import { mollie } from '$lib/server/mollie/client';

export type CreateMollieCustomerData = {
	firstName: string;
	lastName: string;
	email: string;

	donorId: string;
	donorNumber: number;
};

export async function createMollieCustomer(data: CreateMollieCustomerData) {
	return mollie.customers.create({
		idempotencyKey: data.donorId,

		entityCustomer: {
			name: `${data.firstName} ${data.lastName}`,
			email: data.email,

			metadata: {
				donorId: data.donorId,
				donorNumber: data.donorNumber
			}
		}
	});
}

export async function getUsableMollieCustomerMandate(customerId: string) {
	const pages = await mollie.mandates.list({
		customerId,
		limit: 50
	});

	for await (const page of pages) {
		const mandate = page.result.embedded.mandates.find(
			(item) => item.status === 'valid' || item.status === 'pending'
		);

		if (mandate) {
			return mandate;
		}
	}

	return null;
}
