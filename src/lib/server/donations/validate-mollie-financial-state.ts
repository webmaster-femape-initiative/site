import type { MollieRefundSnapshot } from '$lib/server/donations/refunds';
import type { MollieChargebackSnapshot } from '$lib/server/donations/chargebacks';

type MollieAmount = {
	currency: string;
	value: string;
};

export type MollieFinancialStateInput = {
	paymentId: string;
	originalAmount: number;

	amountRefunded: MollieAmount | null | undefined;
	amountChargedBack: MollieAmount | null | undefined;

	refunds: MollieRefundSnapshot[];
	chargebacks: MollieChargebackSnapshot[];
};

function amountToCents(amount: MollieAmount | null | undefined, field: string): number {
	// Mollie peut omettre les montants agrégés
	// lorsqu'aucune opération correspondante n'existe.
	if (amount == null) {
		return 0;
	}

	if (amount.currency !== 'EUR') {
		throw new Error(`Unexpected currency for ${field}: ${amount.currency}.`);
	}

	if (!/^\d+\.\d{2}$/.test(amount.value)) {
		throw new Error(`Invalid Mollie ${field}: ${amount.value}.`);
	}

	const [euros, cents] = amount.value.split('.');

	const value = Number(euros) * 100 + Number(cents);

	if (!Number.isSafeInteger(value) || value < 0) {
		throw new Error(`Invalid Mollie ${field} amount.`);
	}

	return value;
}

/**
 * Vérifie la cohérence entre les montants agrégés
 * du paiement Mollie et ses opérations détaillées.
 *
 * Cette fonction n'effectue aucun accès réseau
 * ni aucune modification en base.
 */
export function validateMollieFinancialState(input: MollieFinancialStateInput) {
	if (!Number.isSafeInteger(input.originalAmount) || input.originalAmount <= 0) {
		throw new Error('Invalid original payment amount.');
	}

	const refundedCents = input.refunds
		.filter((refund) => refund.status === 'refunded')
		.reduce((total, refund) => total + refund.amount, 0);

	const chargedBackCents = input.chargebacks
		.filter((chargeback) => chargeback.status === 'active')
		.reduce((total, chargeback) => total + chargeback.amount, 0);

	if (!Number.isSafeInteger(refundedCents) || !Number.isSafeInteger(chargedBackCents)) {
		throw new Error('Invalid financial operation totals.');
	}

	const mollieRefundedCents = amountToCents(input.amountRefunded, 'amountRefunded');

	const mollieChargedBackCents = amountToCents(input.amountChargedBack, 'amountChargedBack');

	if (refundedCents !== mollieRefundedCents) {
		throw new Error(
			`Refund amount mismatch for payment ${input.paymentId}: ` +
				`details=${refundedCents}, Mollie=${mollieRefundedCents}.`
		);
	}

	if (chargedBackCents !== mollieChargedBackCents) {
		throw new Error(
			`Chargeback amount mismatch for payment ${input.paymentId}: ` +
				`details=${chargedBackCents}, Mollie=${mollieChargedBackCents}.`
		);
	}

	const netAmount = input.originalAmount - refundedCents - chargedBackCents;

	if (!Number.isSafeInteger(netAmount) || netAmount < 0) {
		throw new Error(`Invalid net amount for payment ${input.paymentId}.`);
	}

	return {
		refundedCents,
		chargedBackCents,
		netAmount
	};
}
