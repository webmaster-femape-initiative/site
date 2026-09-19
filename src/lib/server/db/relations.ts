import { relations } from 'drizzle-orm';
import { categories, galleries, media, news, newsCategories, users } from './schema';

export const mediaRelations = relations(media, ({ one }) => ({
	author: one(users, {
		fields: [media.author],
		references: [users.id],
		relationName: 'author'
	})
}));

export const newsRelations = relations(news, ({ one, many }) => ({
	newsCategories: many(newsCategories),
	galleries: many(galleries),
	author: one(users, {
		fields: [news.author],
		references: [users.id],
		relationName: 'author'
	})
}));

export const newsCategoriesRelations = relations(newsCategories, ({ one }) => ({
	news: one(news, {
		fields: [newsCategories.news],
		references: [news.id],
		relationName: 'news'
	}),
	category: one(categories, {
		fields: [newsCategories.category],
		references: [categories.id],
		relationName: 'category'
	})
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
	newsCategories: many(newsCategories)
}));

export const galleriesRelations = relations(galleries, ({ one }) => ({
	news: one(news, {
		fields: [galleries.news],
		references: [news.id],
		relationName: 'news'
	}),
	medium: one(media, {
		fields: [galleries.medium],
		references: [media.id],
		relationName: 'medium'
	})
}));

export const mediaRelation = relations(media, ({ many }) => ({
	galleries: many(galleries)
}));

export const authorNewsRelation = relations(users, ({ many }) => ({
	news: many(news)
}));
