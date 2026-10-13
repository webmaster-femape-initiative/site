export function formatMollieAmount(amountInCents: number): string {
	if (!Number.isInteger(amountInCents)) {
		throw new Error('Amount must be an integer number of cents');
	}

	if (amountInCents <= 0) {
		throw new Error('Amount must be greater than zero');
	}

	return (amountInCents / 100).toFixed(2);
}
