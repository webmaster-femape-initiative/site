import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

import { getLocale } from '$lib/paraglide/runtime';

import { error } from '@sveltejs/kit';
import { newsCategories } from '$lib/server/db/schema';

export const load = (async ({ params }) => {
	const news = await db.query.news.findFirst({
		where: (news, { eq }) => eq(news.id, params.id),

		with: {
			newsCategories: {
				with: {
					category: true
				}
			},

			author: {
				columns: {
					name: true
				}
			},

			galleries: {
				columns: {
					medium: true,
					position: true
				},

				orderBy: (galleries, { asc }) => asc(galleries.position)
			}
		}
	});

	const categoryIds = news?.newsCategories.map((item) => item.category.id) ?? [];

	const relatedNews =
		categoryIds.length > 0
			? await db.query.news.findMany({
					where: (relatedNews, { and, ne, inArray }) =>
						and(
							ne(relatedNews.id, news?.id ?? ''),

							inArray(
								relatedNews.id,
								db
									.select({
										id: newsCategories.news
									})
									.from(newsCategories)
									.where(inArray(newsCategories.category, categoryIds))
							)
						),

					orderBy: (relatedNews, { desc }) => desc(relatedNews.createdAt),

					limit: 3,

					with: {
						galleries: {
							columns: {
								medium: true
							},

							where: (galleries, { eq }) => eq(galleries.position, 0),

							limit: 1
						}
					}
				})
			: [];

	if (!news) {
		error(404, 'Actualité introuvable');
	}

	const locale = getLocale();

	const { galleries, ...newsData } = news;

	const mainImage = galleries.find((media) => media.position === 0);

	const gallery = galleries.filter((media) => media.position >= 1 && media.position <= 6);

	const localizedRelatedNews = relatedNews.map(({ galleries, ...related }) => ({
		...related,

		title: locale === 'en' ? related.titleEn : related.title,

		mediaId: galleries[0]?.medium ?? null
	}));

	return {
		news: {
			...newsData,

			title: locale === 'en' ? news.titleEn : news.title,

			content: locale === 'en' ? news.contentEn : news.content,

			mediaId: mainImage?.medium ?? null,

			gallery
		},

		relatedNews: localizedRelatedNews
	};
}) satisfies PageServerLoad;
