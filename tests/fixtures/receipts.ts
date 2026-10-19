import { eq, desc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { donationReceiptSettings, donationReceipts } from '$lib/server/db/schema';

export async function createReceiptSettingsFixture() {
	const activeSettings = await db
		.select({ id: donationReceiptSettings.id })
		.from(donationReceiptSettings)
		.where(eq(donationReceiptSettings.isActive, true))
		.limit(1);

	if (activeSettings.length > 0) {
		throw new Error('An active receipt configuration already exists in the test database.');
	}

	const [latest] = await db
		.select({ version: donationReceiptSettings.version })
		.from(donationReceiptSettings)
		.orderBy(desc(donationReceiptSettings.version))
		.limit(1);

	const [settings] = await db
		.insert(donationReceiptSettings)
		.values({
			version: (latest?.version ?? 0) + 1,
			isActive: true,
			activatedAt: new Date(),
			organizationName: 'FEMAPE Test',
			rna: 'W000000001',
			address: '1 rue du Test',
			postalCode: '75001',
			city: 'Paris',
			country: 'FR',
			organizationPurpose: 'Tests automatisés',
			organizationCategory: 'Association',
			taxArticle: '200',
			signatoryName: 'Responsable Test',
			signatoryFunction: 'Président'
		})
		.returning();

	return {
		settingsId: settings.id,

		async cleanup() {
			await db.delete(donationReceiptSettings).where(eq(donationReceiptSettings.id, settings.id));
		}
	};
}

export async function cleanupPaymentReceipts(paymentId: string) {
	// Supprimer les révisions de la plus récente à la plus ancienne
	// pour respecter la référence replacesReceiptId.
	const receipts = await db
		.select({
			id: donationReceipts.id
		})
		.from(donationReceipts)
		.where(eq(donationReceipts.paymentId, paymentId))
		.orderBy(desc(donationReceipts.revisionNumber));

	for (const receipt of receipts) {
		await db.delete(donationReceipts).where(eq(donationReceipts.id, receipt.id));
	}
}
