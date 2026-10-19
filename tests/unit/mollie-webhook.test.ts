import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getMolliePayment: vi.fn(),
    getMolliePaymentRefunds: vi.fn(),
    getMolliePaymentChargebacks: vi.fn(),
    getDonationPaymentByMollieId: vi.fn(),
    getDonationByMollieSubscriptionId: vi.fn(),
    createRecurringDonationPayment: vi.fn(),
    updateDonationPaymentStatus: vi.fn(),
    validateMollieFinancialState: vi.fn(),
    syncDonationPaymentChargebacks: vi.fn(),
    syncDonationPaymentRefunds: vi.fn(),
    processPaidDonationPayment: vi.fn(),
    reconcileDonationPaymentReceipt: vi.fn(),
    syncMollieSubscription: vi.fn()
}));

vi.mock('$lib/server/mollie/payments', () => ({
    getMolliePayment: mocks.getMolliePayment,
    getMolliePaymentRefunds: mocks.getMolliePaymentRefunds,
    getMolliePaymentChargebacks: mocks.getMolliePaymentChargebacks
}));
vi.mock('$lib/server/donations/payments', () => ({
    getDonationPaymentByMollieId: mocks.getDonationPaymentByMollieId,
    createRecurringDonationPayment: mocks.createRecurringDonationPayment,
    updateDonationPaymentStatus: mocks.updateDonationPaymentStatus
}));
vi.mock('$lib/server/donations/donations', () => ({
    getDonationByMollieSubscriptionId: mocks.getDonationByMollieSubscriptionId
}));
vi.mock('$lib/server/donations/chargebacks', () => ({
    syncDonationPaymentChargebacks: mocks.syncDonationPaymentChargebacks
}));
vi.mock('$lib/server/donations/refunds', () => ({
    syncDonationPaymentRefunds: mocks.syncDonationPaymentRefunds
}));
vi.mock('$lib/server/donations/process-paid-payment', () => ({
    processPaidDonationPayment: mocks.processPaidDonationPayment
}));
vi.mock('$lib/server/donations/reconcile-receipts', () => ({
    reconcileDonationPaymentReceipt: mocks.reconcileDonationPaymentReceipt
}));
vi.mock('$lib/server/donations/validate-mollie-financial-state', () => ({
    validateMollieFinancialState: mocks.validateMollieFinancialState
}));
vi.mock('$lib/server/donations/sync-subscription-status', () => ({
    syncMollieSubscription: mocks.syncMollieSubscription
}));

// Adapter uniquement cet import si la route réelle est différente.
import { POST } from '../../src/routes/api/mollie/webhook/+server';

const paymentId = 'tr_test123';
const subscriptionId = 'sub_test123';
const donationId = '11111111-1111-4111-8111-111111111111';

function molliePayment(status: string, recurring = true) {
    return {
        id: paymentId,
        status,
        amount: { currency: 'EUR', value: '25.00' },
        amountRefunded: { currency: 'EUR', value: '0.00' },
        amountChargedBack: { currency: 'EUR', value: '0.00' },
        method: 'creditcard',
        subscriptionId: recurring ? subscriptionId : null,
        metadata: { donationId },
        createdAt: '2026-10-19T08:00:00.000Z',
        paidAt: status === 'paid' ? '2026-10-19T08:01:00.000Z' : null
    };
}

function localPayment(status: string) {
    return {
        id: '33333333-3333-4333-8333-333333333333',
        donationId,
        sequenceNumber: 2,
        amount: 2500,
        status,
        molliePaymentMethod: 'creditcard',
        paidAt: status === 'paid' ? new Date('2026-10-19T08:01:00.000Z') : null,
        failedAt: null
    };
}

function requestWithId(id: string): Request {
    const body = new URLSearchParams({ id });
    return new Request('http://localhost/api/mollie/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body
    });
}

async function invoke(id = paymentId): Promise<Response> {
    // RequestHandler attend un RequestEvent complet, mais la route
    // n'utilise que request. Le cast reste limité à cette frontière.
    return POST({ request: requestWithId(id) } as Parameters<typeof POST>[0]) as Promise<Response>;
}

describe('POST /api/mollie/webhook — synchronisation des abonnements', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.getMolliePayment.mockResolvedValue(molliePayment('pending'));
        mocks.getDonationPaymentByMollieId.mockResolvedValue(localPayment('pending'));
        mocks.getMolliePaymentRefunds.mockResolvedValue([]);
        mocks.getMolliePaymentChargebacks.mockResolvedValue([]);
        mocks.syncMollieSubscription.mockResolvedValue('updated');
        mocks.reconcileDonationPaymentReceipt.mockResolvedValue({ action: 'unchanged' });
        mocks.updateDonationPaymentStatus.mockImplementation(async (_id, data) => ({
            ...localPayment('pending'), ...data
        }));
    });

    it('rejette un identifiant de paiement invalide', async () => {
        expect((await invoke('sub_test123')).status).toBe(400);
        expect(mocks.getMolliePayment).not.toHaveBeenCalled();
        expect(mocks.syncMollieSubscription).not.toHaveBeenCalled();
    });

    it('retourne 503 si la lecture du paiement Mollie échoue', async () => {
        mocks.getMolliePayment.mockRejectedValue(new Error('Mollie unavailable'));
        expect((await invoke()).status).toBe(503);
        expect(mocks.syncMollieSubscription).not.toHaveBeenCalled();
    });

    it('synchronise un abonnement pour un paiement pending', async () => {
        expect((await invoke()).status).toBe(200);
        expect(mocks.syncMollieSubscription).toHaveBeenCalledExactlyOnceWith(subscriptionId);
        expect(mocks.processPaidDonationPayment).not.toHaveBeenCalled();
        expect(mocks.reconcileDonationPaymentReceipt).not.toHaveBeenCalled();
    });

    it('n’appelle pas la synchronisation pour un paiement initial sans abonnement', async () => {
        mocks.getMolliePayment.mockResolvedValue(molliePayment('pending', false));
        expect((await invoke()).status).toBe(200);
        expect(mocks.syncMollieSubscription).not.toHaveBeenCalled();
    });

    it('retourne 503 lorsque la synchronisation d’un paiement pending échoue', async () => {
        mocks.syncMollieSubscription.mockRejectedValue(new Error('Mollie unavailable'));
        expect((await invoke()).status).toBe(503);
    });

    it('termine les opérations financières et fiscales avant la synchronisation d’un paiement paid', async () => {
        const order: string[] = [];
        mocks.getMolliePayment.mockResolvedValue(molliePayment('paid'));
        mocks.getDonationPaymentByMollieId.mockResolvedValue(localPayment('paid'));
        mocks.syncDonationPaymentChargebacks.mockImplementation(async () => { order.push('chargebacks'); });
        mocks.syncDonationPaymentRefunds.mockImplementation(async () => { order.push('refunds'); });
        mocks.processPaidDonationPayment.mockImplementation(async () => { order.push('process'); });
        mocks.reconcileDonationPaymentReceipt.mockImplementation(async () => {
            order.push('receipt'); return { action: 'unchanged' };
        });
        mocks.syncMollieSubscription.mockImplementation(async () => {
            order.push('subscription'); return 'updated';
        });

        expect((await invoke()).status).toBe(200);
        expect(order).toEqual(['chargebacks', 'refunds', 'process', 'receipt', 'subscription']);
        expect(mocks.processPaidDonationPayment).toHaveBeenCalledWith(donationId, 2);
        expect(mocks.syncMollieSubscription).toHaveBeenCalledExactlyOnceWith(subscriptionId);
    });

    it('retourne 503 après traitement fiscal si la synchronisation échoue', async () => {
        mocks.getMolliePayment.mockResolvedValue(molliePayment('paid'));
        mocks.getDonationPaymentByMollieId.mockResolvedValue(localPayment('paid'));
        mocks.syncMollieSubscription.mockRejectedValue(new Error('Mollie unavailable'));
        expect((await invoke()).status).toBe(503);
        expect(mocks.processPaidDonationPayment).toHaveBeenCalledOnce();
        expect(mocks.reconcileDonationPaymentReceipt).toHaveBeenCalledOnce();
    });

    it('ne synchronise pas si la validation financière échoue', async () => {
        mocks.getMolliePayment.mockResolvedValue(molliePayment('paid'));
        mocks.getDonationPaymentByMollieId.mockResolvedValue(localPayment('paid'));
        mocks.validateMollieFinancialState.mockImplementation(() => {
            throw new Error('Financial state mismatch');
        });
        expect((await invoke()).status).toBe(503);
        expect(mocks.syncMollieSubscription).not.toHaveBeenCalled();
    });

    it('ne synchronise pas si la réconciliation fiscale échoue', async () => {
        mocks.getMolliePayment.mockResolvedValue(molliePayment('paid'));
        mocks.getDonationPaymentByMollieId.mockResolvedValue(localPayment('paid'));
        mocks.reconcileDonationPaymentReceipt.mockRejectedValue(new Error('Receipt failure'));
        expect((await invoke()).status).toBe(503);
        expect(mocks.syncMollieSubscription).not.toHaveBeenCalled();
    });

    it('crée une échéance inconnue puis synchronise l’abonnement', async () => {
        mocks.getDonationPaymentByMollieId.mockResolvedValue(null);
        mocks.getDonationByMollieSubscriptionId.mockResolvedValue({ id: donationId, amount: 2500 });
        mocks.createRecurringDonationPayment.mockResolvedValue(localPayment('pending'));
        expect((await invoke()).status).toBe(200);
        expect(mocks.createRecurringDonationPayment).toHaveBeenCalledOnce();
        expect(mocks.syncMollieSubscription).toHaveBeenCalledExactlyOnceWith(subscriptionId);
    });

    it('n’effectue pas de nouvelle création lorsque le paiement local existe déjà', async () => {
        expect((await invoke()).status).toBe(200);
        expect((await invoke()).status).toBe(200);
        expect(mocks.createRecurringDonationPayment).not.toHaveBeenCalled();
        expect(mocks.syncMollieSubscription).toHaveBeenCalledTimes(2);
    });

    it('accepte une synchronisation sans modification (unchanged)', async () => {
        mocks.syncMollieSubscription.mockResolvedValue('unchanged');
        expect((await invoke()).status).toBe(200);
    });

    it('accepte un abonnement non trouvé (not_found) sans bloquer le webhook', async () => {
        mocks.syncMollieSubscription.mockResolvedValue('not_found');
        expect((await invoke()).status).toBe(200);
    });
});
