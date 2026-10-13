import { cancelDonationReceiptForPayment } from './receipts';
import { markDonationPaymentRefunded } from './payments';

type MollieAmount = {
	currency: string;
	value: string;
};

export type PaymentReversalData = {
	paymentId: string;
	molliePaymentId: string;
	amount: number;
	amountRefunded?: MollieAmount | null;
	amountChargedBack?: MollieAmount | null;
};

function toCents(amount: MollieAmount | null | undefined): number {
	if (!amount) return 0;

	if (amount.currency !== 'EUR') {
		throw new Error(`Unexpected reversal currency: ${amount.currency}`);
	}

	if (!/^\d+\.\d{2}$/.test(amount.value)) {
		throw new Error(`Invalid reversal amount: ${amount.value}`);
	}

	const [euros, cents] = amount.value.split('.');
	const result = Number(euros) * 100 + Number(cents);

	if (!Number.isSafeInteger(result)) {
		throw new Error(`Invalid reversal amount: ${amount.value}`);
	}

	return result;
}

/**
 * Traite les remboursements et chargebacks d'un paiement Mollie.
 *
 * Le montant local du paiement est exprimé en centimes.
 * Les montants Mollie sont convertis en centimes avant comparaison.
 */
export async function processPaymentReversals(data: PaymentReversalData) {
	const refundedCents = toCents(data.amountRefunded);
	const chargedBackCents = toCents(data.amountChargedBack);

	if (refundedCents === 0 && chargedBackCents === 0) {
		return;
	}

	/*
	 * Un remboursement partiel ne provoque pas automatiquement
	 * l'annulation du reçu fiscal.
	 */
	if (refundedCents + chargedBackCents < data.amount) {
		console.warn('Partial donation payment reversal detected', {
			paymentId: data.paymentId,
			molliePaymentId: data.molliePaymentId,
			amount: data.amount,
			refundedCents,
			chargedBackCents
		});

		return;
	}

	/*
	 * Les fonds correspondant au paiement ont été repris.
	 *
	 * Si les deux types d'opérations sont présents, on conserve
	 * le motif chargeback en priorité.
	 */
	const reason = chargedBackCents > 0 ? 'chargeback' : 'refund';

	await cancelDonationReceiptForPayment(data.paymentId, {
		reason
	});

	if (reason === 'refund') {
		await markDonationPaymentRefunded(data.paymentId);
	}

	console.info('Donation receipt cancelled after payment reversal', {
		paymentId: data.paymentId,
		molliePaymentId: data.molliePaymentId,
		reason
	});
}
