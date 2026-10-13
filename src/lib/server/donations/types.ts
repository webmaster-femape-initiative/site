export type CreateDonorData = {
	firstName: string;
	lastName: string;
	email: string;
	address: string;
	postalCode: string;
	city: string;
	country: string;
};

export type DonationType = 'one-off' | 'recurring';

export type DonationFrequency = 'monthly' | 'quarterly';

export type DonationDuration = 'unlimited' | 'fixed';

export type DonationPaymentMethod = 'card' | 'sepa';

export type CreateDonationData = {
	donorId: string;

	type: DonationType;

	/**
	 * Montant d'une échéance en centimes.
	 */
	amount: number;

	paymentMethod: DonationPaymentMethod;

	frequency?: DonationFrequency | null;
	duration?: DonationDuration | null;
	paymentCount?: number | null;

	donor: CreateDonorData;
};

export type DonationPaymentStatus =
	| 'pending'
	| 'open'
	| 'authorized'
	| 'paid'
	| 'failed'
	| 'cancelled'
	| 'expired'
	| 'refunded'
	| 'charged_back';
