import {
	pgTable,
	text,
	varchar,
	boolean,
	timestamp,
	uuid,
	pgEnum,
	integer,
	customType
} from 'drizzle-orm/pg-core';

const bytea = <Buffer>(name: string) =>
	customType<{ data: Buffer; driverData: Buffer }>({
		dataType() {
			return 'bytea';
		},
		toDriver(value: Buffer): Buffer {
			return value;
		},
		fromDriver(value: Buffer): Buffer {
			return value;
		}
	})(name);

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
