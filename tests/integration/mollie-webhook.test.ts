import { describe, it, expect, vi, beforeEach } from 'vitest';

import { POST } from '../../src/routes/api/mollie/webhook/+server';

import {
	getMolliePayment,
	getMolliePaymentRefunds,
	getMolliePaymentChargebacks
} from '$lib/server/mollie/payments';

import {
	getDonationPaymentByMollieId,
	createRecurringDonationPayment,
	updateDonationPaymentStatus
} from '$lib/server/donations/payments';

import { getDonationByMollieSubscriptionId } from '$lib/server/donations/donations';

import { syncDonationPaymentRefunds } from '$lib/server/donations/refunds';

import { syncDonationPaymentChargebacks } from '$lib/server/donations/chargebacks';

import { processPaidDonationPayment } from '$lib/server/donations/process-paid-payment';

import { reconcileDonationPaymentReceipt } from '$lib/server/donations/reconcile-receipts';

import { validateMollieFinancialState } from '$lib/server/donations/validate-mollie-financial-state';

// ============================================================
// MOCKS
// ============================================================

vi.mock('$lib/server/mollie/payments', () => ({
	getMolliePayment: vi.fn(),
	getMolliePaymentRefunds: vi.fn(),
	getMolliePaymentChargebacks: vi.fn()
}));

vi.mock('$lib/server/donations/payments', () => ({
	getDonationPaymentByMollieId: vi.fn(),
	createRecurringDonationPayment: vi.fn(),
	updateDonationPaymentStatus: vi.fn()
}));

vi.mock('$lib/server/donations/donations', () => ({
	getDonationByMollieSubscriptionId: vi.fn()
}));

vi.mock('$lib/server/donations/refunds', () => ({
	syncDonationPaymentRefunds: vi.fn()
}));

vi.mock('$lib/server/donations/chargebacks', () => ({
	syncDonationPaymentChargebacks: vi.fn()
}));

vi.mock('$lib/server/donations/process-paid-payment', () => ({
	processPaidDonationPayment: vi.fn()
}));

vi.mock('$lib/server/donations/reconcile-receipts', () => ({
	reconcileDonationPaymentReceipt: vi.fn()
}));

vi.mock('$lib/server/donations/validate-mollie-financial-state', () => ({
	validateMollieFinancialState: vi.fn()
}));

// ============================================================
// DONNÉES DE TEST
// ============================================================

const molliePaymentId = 'tr_test123456';

const molliePayment = {
	id: molliePaymentId,
	status: 'paid',
	amount: {
		currency: 'EUR',
		value: '25.00'
	},
	amountRefunded: {
		currency: 'EUR',
		value: '0.00'
	},
	amountChargedBack: {
		currency: 'EUR',
		value: '0.00'
	},
	method: 'creditcard',
	subscriptionId: null,
	metadata: null,
	createdAt: '2026-10-17T10:00:00.000Z',
	paidAt: '2026-10-17T10:01:00.000Z'
};

const localPayment = {
	id: '11111111-1111-4111-8111-111111111111',
	donationId: '22222222-2222-4222-8222-222222222222',
	molliePaymentId,
	sequenceNumber: 1,
	amount: 2500,
	status: 'paid',
	molliePaymentMethod: 'creditcard',
	paidAt: new Date('2026-10-17T10:01:00.000Z'),
	failedAt: null
};

const mollieSubscriptionId = 'sub_test123456';

const recurringDonation = {
	id: localPayment.donationId,
	amount: 2500
};

const recurringMolliePayment = {
	...molliePayment,
	subscriptionId: mollieSubscriptionId,
	metadata: {
		donationId: recurringDonation.id
	}
};

// ============================================================
// HELPERS
// ============================================================

function createWebhookRequest(id: string | null = molliePaymentId) {
	const body = new URLSearchParams();

	if (id !== null) {
		body.set('id', id);
	}

	return new Request('http://localhost/api/mollie/webhook', {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded'
		},
		body
	});
}

async function callWebhook(id: string | null = molliePaymentId) {
	// Le handler n'utilise que request.
	// Le cast permet de l'appeler sans construire un RequestEvent complet.
	return POST({
		request: createWebhookRequest(id)
	} as Parameters<typeof POST>[0]);
}

// ============================================================
// TESTS
// ============================================================

describe('Mollie webhook HTTP', () => {
	beforeEach(() => {
		vi.resetAllMocks();

		vi.mocked(getMolliePayment).mockResolvedValue(
			molliePayment as Awaited<ReturnType<typeof getMolliePayment>>
		);

		vi.mocked(getDonationPaymentByMollieId).mockResolvedValue(
			localPayment as Awaited<ReturnType<typeof getDonationPaymentByMollieId>>
		);

		vi.mocked(getMolliePaymentRefunds).mockResolvedValue([]);
		vi.mocked(getMolliePaymentChargebacks).mockResolvedValue([]);

		vi.mocked(syncDonationPaymentRefunds).mockResolvedValue(undefined as never);

		vi.mocked(syncDonationPaymentChargebacks).mockResolvedValue(undefined as never);

		vi.mocked(updateDonationPaymentStatus).mockResolvedValue(
			localPayment as Awaited<ReturnType<typeof updateDonationPaymentStatus>>
		);

		vi.mocked(processPaidDonationPayment).mockResolvedValue(undefined as never);

		vi.mocked(reconcileDonationPaymentReceipt).mockResolvedValue({
			action: 'unchanged',
			receiptId: null,
			paymentAmount: 2500,
			refundedAmount: 0,
			activeChargebackAmount: 0,
			netAmount: 2500
		});

		vi.mocked(validateMollieFinancialState).mockImplementation(() => undefined as never);
	});

	it('rejects a missing payment ID', async () => {
		const response = await callWebhook(null);

		expect(response.status).toBe(400);
		expect(getMolliePayment).not.toHaveBeenCalled();
	});

	it('rejects an invalid payment ID', async () => {
		const response = await callWebhook('invalid-id');

		expect(response.status).toBe(400);
		expect(getMolliePayment).not.toHaveBeenCalled();
	});

	it('returns 503 when Mollie is unavailable', async () => {
		vi.mocked(getMolliePayment).mockRejectedValue(new Error('Mollie unavailable'));

		const response = await callWebhook();

		expect(response.status).toBe(503);
	});

	it('rejects a mismatched Mollie payment ID', async () => {
		vi.mocked(getMolliePayment).mockResolvedValue({
			...molliePayment,
			id: 'tr_other123'
		} as Awaited<ReturnType<typeof getMolliePayment>>);

		const response = await callWebhook();

		expect(response.status).toBe(500);
		expect(getDonationPaymentByMollieId).not.toHaveBeenCalled();
	});

	it('returns 503 for an unsupported Mollie status', async () => {
		vi.mocked(getMolliePayment).mockResolvedValue({
			...molliePayment,
			status: 'unknown_status'
		} as Awaited<ReturnType<typeof getMolliePayment>>);

		const response = await callWebhook();

		expect(response.status).toBe(503);
	});

	it('acknowledges an unknown payment without subscription', async () => {
		vi.mocked(getDonationPaymentByMollieId).mockResolvedValue(null);

		const response = await callWebhook();

		expect(response.status).toBe(200);
		expect(processPaidDonationPayment).not.toHaveBeenCalled();
	});

	it('does not process an unpaid payment', async () => {
		vi.mocked(getMolliePayment).mockResolvedValue({
			...molliePayment,
			status: 'pending',
			paidAt: null
		} as Awaited<ReturnType<typeof getMolliePayment>>);

		vi.mocked(getDonationPaymentByMollieId).mockResolvedValue({
			...localPayment,
			status: 'pending',
			paidAt: null
		} as Awaited<ReturnType<typeof getDonationPaymentByMollieId>>);

		const response = await callWebhook();

		expect(response.status).toBe(200);
		expect(getMolliePaymentRefunds).not.toHaveBeenCalled();
		expect(processPaidDonationPayment).not.toHaveBeenCalled();
		expect(reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
	});

	it('rejects an inconsistent payment amount', async () => {
		vi.mocked(getMolliePayment).mockResolvedValue({
			...molliePayment,
			amount: {
				currency: 'EUR',
				value: '30.00'
			}
		} as Awaited<ReturnType<typeof getMolliePayment>>);

		const response = await callWebhook();

		expect(response.status).toBe(503);
		expect(syncDonationPaymentRefunds).not.toHaveBeenCalled();
		expect(reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
	});

	it('returns 503 when financial synchronization fails', async () => {
		vi.mocked(syncDonationPaymentRefunds).mockRejectedValue(new Error('Database error'));

		const response = await callWebhook();

		expect(response.status).toBe(503);
		expect(reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
	});

	it('returns 503 when fiscal reconciliation fails', async () => {
		vi.mocked(reconcileDonationPaymentReceipt).mockRejectedValue(new Error('Receipt error'));

		const response = await callWebhook();

		expect(response.status).toBe(503);
	});

	it('processes a paid donation successfully', async () => {
		const response = await callWebhook();

		expect(response.status).toBe(200);

		expect(validateMollieFinancialState).toHaveBeenCalledOnce();

		expect(syncDonationPaymentChargebacks).toHaveBeenCalledOnce();
		expect(syncDonationPaymentRefunds).toHaveBeenCalledOnce();

		expect(processPaidDonationPayment).toHaveBeenCalledWith(
			localPayment.donationId,
			localPayment.sequenceNumber
		);

		expect(reconcileDonationPaymentReceipt).toHaveBeenCalledWith(localPayment.id);
	});
});

describe('Mollie webhook - recurring payments', () => {
	beforeEach(() => {
		vi.resetAllMocks();

		// Paiement Mollie associé à un abonnement.
		vi.mocked(getMolliePayment).mockResolvedValue(
			recurringMolliePayment as unknown as Awaited<ReturnType<typeof getMolliePayment>>
		);

		// L'échéance n'existe pas encore localement.
		vi.mocked(getDonationPaymentByMollieId).mockResolvedValue(null);

		// L'abonnement correspond à un don connu.
		vi.mocked(getDonationByMollieSubscriptionId).mockResolvedValue(
			recurringDonation as Awaited<ReturnType<typeof getDonationByMollieSubscriptionId>>
		);

		// Création simulée de l'échéance.
		vi.mocked(createRecurringDonationPayment).mockResolvedValue(
			localPayment as Awaited<ReturnType<typeof createRecurringDonationPayment>>
		);

		vi.mocked(getMolliePaymentRefunds).mockResolvedValue([]);

		vi.mocked(getMolliePaymentChargebacks).mockResolvedValue([]);

		vi.mocked(syncDonationPaymentRefunds).mockResolvedValue(undefined as never);

		vi.mocked(syncDonationPaymentChargebacks).mockResolvedValue(undefined as never);

		vi.mocked(processPaidDonationPayment).mockResolvedValue(undefined as never);

		vi.mocked(reconcileDonationPaymentReceipt).mockResolvedValue({
			action: 'unchanged',
			receiptId: null,
			paymentAmount: 2500,
			refundedAmount: 0,
			activeChargebackAmount: 0,
			netAmount: 2500
		});

		vi.mocked(validateMollieFinancialState).mockImplementation(() => undefined as never);
	});

	// ========================================================
	// 1. CRÉATION D'UNE NOUVELLE ÉCHÉANCE
	// ========================================================

	it('creates a recurring payment for a known subscription', async () => {
		const response = await callWebhook();

		expect(response.status).toBe(200);

		expect(getDonationByMollieSubscriptionId).toHaveBeenCalledWith(mollieSubscriptionId);

		expect(createRecurringDonationPayment).toHaveBeenCalledOnce();

		expect(createRecurringDonationPayment).toHaveBeenCalledWith(
			expect.objectContaining({
				donationId: recurringDonation.id,
				molliePaymentId,
				amount: 2500,
				status: 'paid',
				molliePaymentMethod: 'creditcard',
				paidAt: new Date(recurringMolliePayment.paidAt)
			})
		);

		expect(processPaidDonationPayment).toHaveBeenCalledWith(
			localPayment.donationId,
			localPayment.sequenceNumber
		);

		expect(reconcileDonationPaymentReceipt).toHaveBeenCalledWith(localPayment.id);
	});

	// ========================================================
	// 2. ABONNEMENT INCONNU
	// ========================================================

	it('acknowledges a payment for an unknown subscription', async () => {
		vi.mocked(getDonationByMollieSubscriptionId).mockResolvedValue(null);

		const response = await callWebhook();

		expect(response.status).toBe(200);

		expect(createRecurringDonationPayment).not.toHaveBeenCalled();

		expect(processPaidDonationPayment).not.toHaveBeenCalled();

		expect(reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
	});

	// ========================================================
	// 3. MÉTADONNÉES INCOHÉRENTES
	// ========================================================

	it('rejects recurring payment with mismatched donation metadata', async () => {
		vi.mocked(getMolliePayment).mockResolvedValue({
			...recurringMolliePayment,
			metadata: {
				donationId: '33333333-3333-4333-8333-333333333333'
			}
		} as unknown as Awaited<ReturnType<typeof getMolliePayment>>);

		const response = await callWebhook();

		expect(response.status).toBe(500);

		expect(createRecurringDonationPayment).not.toHaveBeenCalled();

		expect(processPaidDonationPayment).not.toHaveBeenCalled();

		expect(reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
	});

	// ========================================================
	// 4. MONTANT RÉCURRENT INCORRECT
	// ========================================================

	it('rejects recurring payment with incorrect amount', async () => {
		vi.mocked(getMolliePayment).mockResolvedValue({
			...recurringMolliePayment,
			amount: {
				currency: 'EUR',
				value: '30.00'
			}
		} as unknown as Awaited<ReturnType<typeof getMolliePayment>>);

		const response = await callWebhook();

		expect(response.status).toBe(500);

		expect(createRecurringDonationPayment).not.toHaveBeenCalled();

		expect(processPaidDonationPayment).not.toHaveBeenCalled();

		expect(reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
	});
});

describe('Mollie webhook - idempotency and errors', () => {
	beforeEach(() => {
		vi.resetAllMocks();

		vi.mocked(getMolliePayment).mockResolvedValue(
			molliePayment as unknown as Awaited<ReturnType<typeof getMolliePayment>>
		);

		vi.mocked(getDonationPaymentByMollieId).mockResolvedValue(
			localPayment as Awaited<ReturnType<typeof getDonationPaymentByMollieId>>
		);

		vi.mocked(getMolliePaymentRefunds).mockResolvedValue([]);

		vi.mocked(getMolliePaymentChargebacks).mockResolvedValue([]);

		vi.mocked(syncDonationPaymentRefunds).mockResolvedValue(undefined as never);

		vi.mocked(syncDonationPaymentChargebacks).mockResolvedValue(undefined as never);

		vi.mocked(processPaidDonationPayment).mockResolvedValue(undefined as never);

		vi.mocked(reconcileDonationPaymentReceipt).mockResolvedValue({
			action: 'unchanged',
			receiptId: null,
			paymentAmount: 2500,
			refundedAmount: 0,
			activeChargebackAmount: 0,
			netAmount: 2500
		});

		vi.mocked(validateMollieFinancialState).mockImplementation(() => undefined as never);
	});

	// ========================================================
	// 1. NOTIFICATION RÉPÉTÉE
	// ========================================================

	it('handles repeated notifications for an existing payment', async () => {
		const firstResponse = await callWebhook();
		const secondResponse = await callWebhook();

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);

		// Le paiement existe déjà localement.
		expect(getDonationPaymentByMollieId).toHaveBeenCalledTimes(2);

		// Aucune nouvelle échéance ne doit être créée.
		expect(createRecurringDonationPayment).not.toHaveBeenCalled();

		// Les traitements peuvent être relancés :
		// leur idempotence est assurée par les services métier.
		expect(processPaidDonationPayment).toHaveBeenCalledTimes(2);

		expect(reconcileDonationPaymentReceipt).toHaveBeenCalledTimes(2);

		expect(reconcileDonationPaymentReceipt).toHaveBeenNthCalledWith(1, localPayment.id);

		expect(reconcileDonationPaymentReceipt).toHaveBeenNthCalledWith(2, localPayment.id);
	});

	// ========================================================
	// 2. ÉCHEC DE CRÉATION D'UNE ÉCHÉANCE RÉCURRENTE
	// ========================================================

	it('returns 503 when recurring payment creation fails', async () => {
		vi.mocked(getMolliePayment).mockResolvedValue({
			...recurringMolliePayment
		} as unknown as Awaited<ReturnType<typeof getMolliePayment>>);

		vi.mocked(getDonationPaymentByMollieId).mockResolvedValue(null);

		vi.mocked(getDonationByMollieSubscriptionId).mockResolvedValue(
			recurringDonation as Awaited<ReturnType<typeof getDonationByMollieSubscriptionId>>
		);

		vi.mocked(createRecurringDonationPayment).mockRejectedValue(
			new Error('Database insertion failed')
		);

		const response = await callWebhook();

		expect(response.status).toBe(503);

		expect(createRecurringDonationPayment).toHaveBeenCalledOnce();

		expect(createRecurringDonationPayment).toHaveBeenCalledWith(
			expect.objectContaining({
				donationId: recurringDonation.id,
				molliePaymentId,
				amount: 2500,
				status: 'paid'
			})
		);

		// Aucun traitement ultérieur ne doit être effectué.
		expect(processPaidDonationPayment).not.toHaveBeenCalled();

		expect(reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
	});

	// ========================================================
	// 3. ÉCHEC DU TRAITEMENT MÉTIER
	// ========================================================

	it('returns 503 when paid payment processing fails', async () => {
		vi.mocked(processPaidDonationPayment).mockRejectedValue(
			new Error('Donation processing failed')
		);

		const response = await callWebhook();

		expect(response.status).toBe(503);

		// La synchronisation financière a été exécutée.
		expect(syncDonationPaymentChargebacks).toHaveBeenCalledOnce();

		expect(syncDonationPaymentRefunds).toHaveBeenCalledOnce();

		expect(processPaidDonationPayment).toHaveBeenCalledWith(
			localPayment.donationId,
			localPayment.sequenceNumber
		);

		// La réconciliation ne doit pas être déclenchée
		// si le traitement métier a échoué.
		expect(reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
	});

	// ========================================================
	// 4. RÉCONCILIATION NÉCESSITANT UNE REVUE MANUELLE
	// ========================================================

	it('acknowledges a payment requiring manual fiscal review', async () => {
		vi.mocked(reconcileDonationPaymentReceipt).mockResolvedValue({
			action: 'manual_review_required',
			receiptId: '33333333-3333-4333-8333-333333333333',
			paymentAmount: 2500,
			refundedAmount: 0,
			activeChargebackAmount: 0,
			netAmount: 2500
		});

		const response = await callWebhook();

		// Une revue manuelle ne constitue pas une erreur HTTP.
		expect(response.status).toBe(200);

		expect(processPaidDonationPayment).toHaveBeenCalledOnce();

		expect(reconcileDonationPaymentReceipt).toHaveBeenCalledOnce();

		expect(reconcileDonationPaymentReceipt).toHaveBeenCalledWith(localPayment.id);

		// Le webhook n'appelle pas directement
		// le service de création des reçus fiscaux.
		// La décision appartient au service de réconciliation.
	});
});
