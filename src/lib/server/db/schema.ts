import { sql } from 'drizzle-orm';
import {
	bigint,
	check,
	index,
	pgSequence,
	uniqueIndex,
	pgTable,
	text,
	varchar,
	boolean,
	timestamp,
	uuid,
	pgEnum,
	integer,
	customType,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';

export const donationTypeEnum = pgEnum('donation_type_enum', ['one-off', 'recurring']);

export const donationFrequencyEnum = pgEnum('donation_frequency_enum', ['monthly', 'quarterly']);

export const donationDurationEnum = pgEnum('donation_duration_enum', ['unlimited', 'fixed']);

export const donationPaymentMethodEnum = pgEnum('donation_payment_method_enum', ['card', 'sepa']);

export const donationStatusEnum = pgEnum('donation_status_enum', [
	'pending',
	'active',
	'completed',
	'cancelled',
	'failed'
]);

export const donationPaymentStatusEnum = pgEnum('donation_payment_status_enum', [
	'pending',
	'open',
	'authorized',
	'paid',
	'failed',
	'cancelled',
	'expired',
	'refunded',
	'charged_back'
]);

export const donationReceiptStatusEnum = pgEnum('donation_receipt_status_enum', [
	'valid',
	'cancelled'
]);

export const donationReceiptCancellationReasonEnum = pgEnum(
	'donation_receipt_cancellation_reason_enum',
	['refund', 'chargeback', 'manual']
);

export const donationPaymentRefundStatusEnum = pgEnum('donation_payment_refund_status_enum', [
	'queued',
	'pending',
	'processing',
	'refunded',
	'failed',
	'canceled'
]);

export const donorNumberSequence = pgSequence('donor_number_seq', {
	startWith: 1,
	increment: 1
});

const bytea = customType<{
	data: Buffer;
	driverData: Buffer;
}>({
	dataType() {
		return 'bytea';
	},

	toDriver(value: Buffer): Buffer {
		return value;
	},

	fromDriver(value: Buffer): Buffer {
		return value;
	}
});

export const users = pgTable('users', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: varchar('name', { length: 50 }).notNull(),
	email: varchar('email', { length: 255 }).unique().notNull(),
	emailVerified: boolean('email_verified').notNull(),
	image: text(),
	role: text('role'),
	banned: boolean('banned'),
	banReason: text('ban_reason'),
	banExpires: timestamp('ban_expires', { precision: 6, withTimezone: true }),
	isFirstUser: boolean('is_first_user'),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const categoryNameEnum = pgEnum('category_name_enum', [
	'Fédération',
	'France',
	'Maraudes',
	'Délégations',
	'Burkina-Faso',
	'Madagascar'
]);

export const categoryEnglishNameEnum = pgEnum('english_category_name_enum', [
	'Federation',
	'France',
	'Marauding',
	'Delegations',
	'Burkina-Faso',
	'Madagascar'
]);

export const media = pgTable('media', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: varchar('name', { length: 255 }).notNull(),
	type: varchar('type', { length: 50 }).notNull(),
	description: text('description'),
	author: uuid('author_id')
		.notNull()
		.references(() => users.id),
	content: bytea('content').notNull(),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const categories = pgTable('categories', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: categoryNameEnum('name').notNull().unique(),
	englisgName: categoryEnglishNameEnum('english_name').unique()
});

export const news = pgTable('news', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: varchar('title', { length: 255 }).unique().notNull(),
	titleEn: varchar('title_en', { length: 255 }).unique().notNull(),
	content: text('content').notNull(),
	contentEn: text('content_en').notNull(),
	author: uuid('author_id')
		.notNull()
		.references(() => users.id),
	createdAt: timestamp('created_at').notNull().defaultNow()
});
export const newsCategories = pgTable('news_categories', {
	news: uuid('news_id')
		.notNull()
		.references(() => news.id),
	category: uuid('category_id')
		.notNull()
		.references(() => categories.id)
});

export const galleries = pgTable('galleries', {
	news: uuid('news_id')
		.notNull()
		.references(() => news.id),
	medium: uuid('media_id')
		.notNull()
		.references(() => media.id),
	position: integer().notNull()
});

export const authorProfile = pgTable('author_profile', {
	userId: uuid('user_id')
		.notNull()
		.references(() => users.id),
	func: varchar('function', { length: 255 }).notNull(),
	description: text('description'),
	x: varchar('x', { length: 255 }),
	facebook: varchar('facebook', { length: 255 }),
	instagram: varchar('instagram', { length: 255 }),
	photo: uuid('photo')
		.notNull()
		.references(() => media.id)
});

export const donors = pgTable(
	'donors',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		donorNumber: bigint('donor_number', {
			mode: 'number'
		})
			.notNull()
			.default(sql`nextval('donor_number_seq')`),

		firstName: varchar('first_name', {
			length: 100
		}).notNull(),

		lastName: varchar('last_name', {
			length: 100
		}).notNull(),

		email: varchar('email', {
			length: 254
		}).notNull(),

		address: varchar('address', {
			length: 200
		}).notNull(),

		postalCode: varchar('postal_code', {
			length: 20
		}).notNull(),

		city: varchar('city', {
			length: 100
		}).notNull(),

		country: varchar('country', {
			length: 2
		}).notNull(),

		mollieCustomerId: varchar('mollie_customer_id', {
			length: 50
		}),

		createdAt: timestamp('created_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow(),

		updatedAt: timestamp('updated_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('donors_donor_number_uidx').on(table.donorNumber),

		uniqueIndex('donors_mollie_customer_id_uidx').on(table.mollieCustomerId),

		index('donors_email_idx').on(table.email),

		index('donors_last_name_idx').on(table.lastName),

		check('donors_donor_number_positive_check', sql`${table.donorNumber} > 0`),

		check('donors_country_length_check', sql`char_length(${table.country}) = 2`)
	]
);

export const donations = pgTable(
	'donations',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		donorId: uuid('donor_id')
			.notNull()
			.references(() => donors.id),

		type: donationTypeEnum('type').notNull(),

		amount: integer('amount').notNull(),

		paymentMethod: donationPaymentMethodEnum('payment_method').notNull(),

		frequency: donationFrequencyEnum('frequency'),

		duration: donationDurationEnum('duration'),

		paymentCount: integer('payment_count'),

		status: donationStatusEnum('status').notNull().default('pending'),

		mollieSubscriptionId: varchar('mollie_subscription_id', {
			length: 50
		}),

		/* Snapshot lors de la souscription */

		donorFirstName: varchar('donor_first_name', { length: 100 }).notNull(),

		donorLastName: varchar('donor_last_name', { length: 100 }).notNull(),

		donorEmail: varchar('donor_email', { length: 254 }).notNull(),

		donorAddress: varchar('donor_address', { length: 200 }).notNull(),

		donorPostalCode: varchar('donor_postal_code', { length: 20 }).notNull(),

		donorCity: varchar('donor_city', { length: 100 }).notNull(),

		donorCountry: varchar('donor_country', { length: 2 }).notNull(),

		createdAt: timestamp('created_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow(),

		updatedAt: timestamp('updated_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow(),

		cancelledAt: timestamp('cancelled_at', {
			withTimezone: true
		}),

		completedAt: timestamp('completed_at', {
			withTimezone: true
		})
	},
	(table) => [
		index('donations_donor_id_idx').on(table.donorId),

		index('donations_status_idx').on(table.status),

		index('donations_donor_created_at_idx').on(table.donorId, table.createdAt),

		uniqueIndex('donations_mollie_subscription_id_uidx').on(table.mollieSubscriptionId),

		check('donations_amount_minimum_check', sql`${table.amount} >= 200`),

		check('donations_amount_maximum_check', sql`${table.amount} <= 10000000`),

		check('donations_country_check', sql`char_length(${table.donorCountry}) = 2`),

		check(
			'donations_recurrence_check',
			sql`
				(
					${table.type} = 'one-off'
					AND ${table.frequency} IS NULL
					AND ${table.duration} IS NULL
					AND ${table.paymentCount} IS NULL
				)
				OR
				(
					${table.type} = 'recurring'
					AND ${table.frequency} IS NOT NULL
					AND ${table.duration} IS NOT NULL
				)
			`
		),

		check(
			'donations_duration_check',
			sql`
				${table.type} = 'one-off'
				OR
				(
					${table.duration} = 'unlimited'
					AND ${table.paymentCount} IS NULL
				)
				OR
				(
					${table.duration} = 'fixed'
					AND ${table.paymentCount} >= 2
				)
			`
		)
	]
);

export const donationPayments = pgTable(
	'donation_payments',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		donationId: uuid('donation_id')
			.notNull()
			.references(() => donations.id),

		sequenceNumber: integer('sequence_number').notNull(),

		amount: integer('amount').notNull(),

		molliePaymentId: varchar('mollie_payment_id', {
			length: 50
		}),

		mollieCreatedAt: timestamp('mollie_created_at', {
			withTimezone: true
		}),

		/**
		 * Moyen de paiement réellement utilisé côté Mollie.
		 *
		 * Il est inconnu lors de la création initiale du
		 * donation_payment et est renseigné ultérieurement
		 * à partir du paiement retourné par Mollie.
		 *
		 * Exemples :
		 * - creditcard
		 * - directdebit
		 * - ideal
		 * - paypal
		 *
		 * Il ne faut pas utiliser donationPaymentMethodEnum ici :
		 * cet enum représente les choix métier proposés par FEMAPE,
		 * et non les valeurs retournées par Mollie.
		 */
		molliePaymentMethod: varchar('mollie_payment_method', {
			length: 50
		}),

		status: donationPaymentStatusEnum('status').notNull().default('pending'),

		/* Snapshot au moment du paiement */

		donorFirstName: varchar('donor_first_name', {
			length: 100
		}).notNull(),

		donorLastName: varchar('donor_last_name', {
			length: 100
		}).notNull(),

		donorEmail: varchar('donor_email', {
			length: 254
		}).notNull(),

		donorAddress: varchar('donor_address', {
			length: 200
		}).notNull(),

		donorPostalCode: varchar('donor_postal_code', {
			length: 20
		}).notNull(),

		donorCity: varchar('donor_city', {
			length: 100
		}).notNull(),

		donorCountry: varchar('donor_country', {
			length: 2
		}).notNull(),

		createdAt: timestamp('created_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow(),

		paidAt: timestamp('paid_at', {
			withTimezone: true
		}),

		failedAt: timestamp('failed_at', {
			withTimezone: true
		}),

		refundedAt: timestamp('refunded_at', {
			withTimezone: true
		})
	},
	(table) => [
		index('donation_payments_donation_id_idx').on(table.donationId),

		index('donation_payments_status_idx').on(table.status),

		index('donation_payments_mollie_created_at_idx').on(table.mollieCreatedAt),

		uniqueIndex('donation_payments_donation_sequence_uidx').on(
			table.donationId,
			table.sequenceNumber
		),

		uniqueIndex('donation_payments_mollie_payment_id_uidx').on(table.molliePaymentId),

		check('donation_payments_sequence_check', sql`${table.sequenceNumber} >= 1`),

		check('donation_payments_amount_check', sql`${table.amount} >= 200`),

		check('donation_payments_country_check', sql`char_length(${table.donorCountry}) = 2`)
	]
);

export const donationPaymentRefunds = pgTable(
	'donation_payment_refunds',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		paymentId: uuid('payment_id')
			.notNull()
			.references(() => donationPayments.id),

		mollieRefundId: varchar('mollie_refund_id', {
			length: 50
		}).notNull(),

		amount: integer('amount').notNull(),

		status: donationPaymentRefundStatusEnum('status').notNull(),

		mollieCreatedAt: timestamp('mollie_created_at', {
			withTimezone: true
		}),

		refundedAt: timestamp('refunded_at', {
			withTimezone: true
		}),

		createdAt: timestamp('created_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow(),

		updatedAt: timestamp('updated_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('donation_payment_refunds_mollie_id_uidx').on(table.mollieRefundId),

		index('donation_payment_refunds_payment_id_idx').on(table.paymentId),

		check('donation_payment_refunds_amount_check', sql`${table.amount} > 0`),

		check(
			'donation_payment_refunds_refunded_at_check',
			sql`
				${table.status} = 'refunded'
				OR ${table.refundedAt} IS NULL
			`
		)
	]
);

export const donationReceiptDocumentStatusEnum = pgEnum('donation_receipt_document_status_enum', [
	'pending',
	'generated',
	'failed'
]);

export const donationReceiptNumberSequence = pgSequence('donation_receipt_number_seq', {
	startWith: 1,
	increment: 1
});

export const donationReceiptSettings = pgTable(
	'donation_receipt_settings',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		version: integer('version').notNull(),

		isActive: boolean('is_active').notNull().default(false),

		organizationName: varchar('organization_name', { length: 255 }).notNull(),

		siren: varchar('siren', { length: 9 }),

		rna: varchar('rna', { length: 20 }),

		address: varchar('address', { length: 255 }).notNull(),

		postalCode: varchar('postal_code', { length: 20 }).notNull(),

		city: varchar('city', { length: 100 }).notNull(),

		country: varchar('country', { length: 2 }).notNull().default('FR'),

		organizationPurpose: text('organization_purpose').notNull(),

		organizationCategory: varchar('organization_category', { length: 255 }).notNull(),

		taxArticle: varchar('tax_article', { length: 50 }).notNull(),

		signatoryName: varchar('signatory_name', { length: 200 }),

		signatoryFunction: varchar('signatory_function', { length: 200 }),

		signature: bytea('signature'),

		signatureMimeType: varchar('signature_mime_type', { length: 100 }),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

		activatedAt: timestamp('activated_at', { withTimezone: true })
	},
	(table) => [
		uniqueIndex('donation_receipt_settings_version_uidx').on(table.version),

		uniqueIndex('donation_receipt_settings_one_active_uidx')
			.on(table.isActive)
			.where(sql`${table.isActive} = true`),

		check('donation_receipt_settings_version_check', sql`${table.version} >= 1`),

		check(
			'donation_receipt_settings_identifier_check',
			sql`${table.siren} IS NOT NULL OR ${table.rna} IS NOT NULL`
		),

		check('donation_receipt_settings_country_check', sql`char_length(${table.country}) = 2`),

		check(
			'donation_receipt_settings_signature_check',
			sql`
				(
					${table.signature} IS NULL
					AND ${table.signatureMimeType} IS NULL
				)
				OR
				(
					${table.signature} IS NOT NULL
					AND ${table.signatureMimeType} IS NOT NULL
				)
			`
		)
	]
);

export const donationReceipts = pgTable(
	'donation_receipts',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		paymentId: uuid('payment_id')
			.notNull()
			.references(() => donationPayments.id),

		replacesReceiptId: uuid('replaces_receipt_id').references(
			(): AnyPgColumn => donationReceipts.id
		),

		revisionNumber: integer('revision_number').notNull().default(1),

		settingsId: uuid('settings_id')
			.notNull()
			.references(() => donationReceiptSettings.id),

		receiptNumber: bigint('receipt_number', { mode: 'number' })
			.notNull()
			.default(sql`nextval('donation_receipt_number_seq')`),

		amount: integer('amount').notNull(),

		donationDate: timestamp('donation_date', { withTimezone: true }).notNull(),

		donationForm: varchar('donation_form', { length: 100 }).notNull().default('manual-donation'),

		donationNature: varchar('donation_nature', { length: 100 }).notNull().default('money'),

		paymentMode: varchar('payment_mode', { length: 100 }).notNull(),

		taxArticle: varchar('tax_article', { length: 50 }).notNull(),

		donorFirstName: varchar('donor_first_name', { length: 100 }).notNull(),

		donorLastName: varchar('donor_last_name', { length: 100 }).notNull(),

		donorAddress: varchar('donor_address', { length: 200 }).notNull(),

		donorPostalCode: varchar('donor_postal_code', { length: 20 }).notNull(),

		donorCity: varchar('donor_city', { length: 100 }).notNull(),

		donorCountry: varchar('donor_country', { length: 2 }).notNull(),

		organizationName: varchar('organization_name', { length: 255 }).notNull(),

		organizationSiren: varchar('organization_siren', { length: 9 }),

		organizationRna: varchar('organization_rna', { length: 20 }),

		organizationAddress: varchar('organization_address', { length: 255 }).notNull(),

		organizationPostalCode: varchar('organization_postal_code', { length: 20 }).notNull(),

		organizationCity: varchar('organization_city', { length: 100 }).notNull(),

		organizationCountry: varchar('organization_country', { length: 2 }).notNull(),

		organizationPurpose: text('organization_purpose').notNull(),

		organizationCategory: varchar('organization_category', { length: 255 }).notNull(),

		signatoryName: varchar('signatory_name', { length: 200 }),

		signatoryFunction: varchar('signatory_function', { length: 200 }),

		signature: bytea('signature'),

		signatureMimeType: varchar('signature_mime_type', { length: 100 }),

		/* ========================================================
		 * STATUT MÉTIER ET ANNULATION
		 * ======================================================== */

		status: donationReceiptStatusEnum('status').notNull().default('valid'),

		cancelledAt: timestamp('cancelled_at', {
			withTimezone: true
		}),

		cancellationReason: donationReceiptCancellationReasonEnum('cancellation_reason'),

		cancellationComment: text('cancellation_comment'),

		documentStatus: donationReceiptDocumentStatusEnum('document_status')
			.notNull()
			.default('pending'),

		document: bytea('document'),

		documentMimeType: varchar('document_mime_type', { length: 100 }),

		documentError: text('document_error'),

		documentGeneratedAt: timestamp('document_generated_at', { withTimezone: true }),

		/* ========================================================
		 * PDF ANNULÉ
		 * ======================================================== */

		cancelledDocumentStatus: donationReceiptDocumentStatusEnum('cancelled_document_status'),

		cancelledDocument: bytea('cancelled_document'),

		cancelledDocumentMimeType: varchar('cancelled_document_mime_type', { length: 100 }),

		cancelledDocumentError: text('cancelled_document_error'),

		cancelledDocumentGeneratedAt: timestamp('cancelled_document_generated_at', {
			withTimezone: true
		}),

		issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(table) => [
		index('donation_receipts_payment_id_idx').on(table.paymentId),

		uniqueIndex('donation_receipts_one_valid_per_payment_uidx')
			.on(table.paymentId)
			.where(sql`${table.status} = 'valid'`),

		uniqueIndex('donation_receipts_payment_revision_uidx').on(
			table.paymentId,
			table.revisionNumber
		),

		uniqueIndex('donation_receipts_replaces_receipt_uidx').on(table.replacesReceiptId),

		check('donation_receipts_revision_number_check', sql`${table.revisionNumber} >= 1`),

		check(
			'donation_receipts_revision_link_check',
			sql`
		(
			${table.revisionNumber} = 1
			AND ${table.replacesReceiptId} IS NULL
		)
		OR
		(
			${table.revisionNumber} > 1
			AND ${table.replacesReceiptId} IS NOT NULL
		)
	`
		),

		uniqueIndex('donation_receipts_receipt_number_uidx').on(table.receiptNumber),

		index('donation_receipts_settings_id_idx').on(table.settingsId),

		index('donation_receipts_donation_date_idx').on(table.donationDate),

		check('donation_receipts_amount_check', sql`${table.amount} >= 200`),

		check('donation_receipts_donor_country_check', sql`char_length(${table.donorCountry}) = 2`),

		check(
			'donation_receipts_organization_country_check',
			sql`char_length(${table.organizationCountry}) = 2`
		),

		check(
			'donation_receipts_identifier_check',
			sql`
				${table.organizationSiren} IS NOT NULL
				OR
				${table.organizationRna} IS NOT NULL
			`
		),

		check(
			'donation_receipts_signature_check',
			sql`
				(
					${table.signature} IS NULL
					AND ${table.signatureMimeType} IS NULL
				)
				OR
				(
					${table.signature} IS NOT NULL
					AND ${table.signatureMimeType} IS NOT NULL
				)
			`
		),

		check(
			'donation_receipts_document_data_check',
			sql`
				(
					${table.document} IS NULL
					AND ${table.documentMimeType} IS NULL
				)
				OR
				(
					${table.document} IS NOT NULL
					AND ${table.documentMimeType} IS NOT NULL
				)
			`
		),

		check(
			'donation_receipts_document_mime_check',
			sql`
				${table.documentMimeType} IS NULL
				OR
				${table.documentMimeType} = 'application/pdf'
			`
		),

		check(
			'donation_receipts_document_status_check',
			sql`
				(
					${table.documentStatus} = 'pending'
					AND ${table.document} IS NULL
					AND ${table.documentMimeType} IS NULL
					AND ${table.documentError} IS NULL
					AND ${table.documentGeneratedAt} IS NULL
				)
				OR
				(
					${table.documentStatus} = 'generated'
					AND ${table.document} IS NOT NULL
					AND ${table.documentMimeType} = 'application/pdf'
					AND ${table.documentError} IS NULL
					AND ${table.documentGeneratedAt} IS NOT NULL
				)
				OR
				(
					${table.documentStatus} = 'failed'
					AND ${table.document} IS NULL
					AND ${table.documentMimeType} IS NULL
					AND ${table.documentError} IS NOT NULL
					AND ${table.documentGeneratedAt} IS NULL
				)
			`
		)
	]
);

export const donationPaymentChargebacks = pgTable(
	'donation_payment_chargebacks',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		paymentId: uuid('payment_id')
			.notNull()
			.references(() => donationPayments.id),

		mollieChargebackId: varchar('mollie_chargeback_id', {
			length: 50
		}).notNull(),

		// Montant contesté, en centimes
		amount: integer('amount').notNull(),

		// Statut retourné par Mollie
		status: varchar('status', {
			length: 30
		}).notNull(),

		// Date de création chez Mollie
		mollieCreatedAt: timestamp('mollie_created_at', {
			withTimezone: true
		}),

		// Date de dernière synchronisation avec Mollie
		syncedAt: timestamp('synced_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow(),

		createdAt: timestamp('created_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow(),

		updatedAt: timestamp('updated_at', {
			withTimezone: true
		})
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('donation_payment_chargebacks_mollie_id_uidx').on(table.mollieChargebackId),

		index('donation_payment_chargebacks_payment_id_idx').on(table.paymentId),

		index('donation_payment_chargebacks_status_idx').on(table.status),

		check('donation_payment_chargebacks_amount_check', sql`${table.amount} > 0`)
	]
);
