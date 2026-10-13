export type PaymentNetAmountInput = {
	paymentAmount: number;
	refundedAmount: number;
	activeChargebackAmount: number;
};

export type PaymentNetAmountResult = {
	paymentAmount: number;
	refundedAmount: number;
	activeChargebackAmount: number;
	netAmount: number;
};

export function calculatePaymentNetAmount(input: PaymentNetAmountInput): PaymentNetAmountResult {
	const { paymentAmount, refundedAmount, activeChargebackAmount } = input;

	for (const [name, value] of Object.entries(input)) {
		if (!Number.isSafeInteger(value) || value < 0) {
			throw new Error(`Invalid ${name}: expected a non-negative integer of cents.`);
		}
	}

	if (paymentAmount <= 0) {
		throw new Error('Payment amount must be positive.');
	}

	const reversedAmount = refundedAmount + activeChargebackAmount;

	if (!Number.isSafeInteger(reversedAmount) || reversedAmount > paymentAmount) {
		throw new Error('Confirmed refunds and active chargebacks exceed payment amount.');
	}

	return {
		paymentAmount,
		refundedAmount,
		activeChargebackAmount,
		netAmount: paymentAmount - reversedAmount
	};
}
