import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import { getLocale } from '$lib/paraglide/runtime';

export const load = (async () => {
	const newsList = await db.query.news.findMany({
		limit: 3,
		orderBy: (news, { desc }) => desc(news.createdAt),
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
					medium: true
				},
				where: (galleries, { eq }) => eq(galleries.position, 0),
				limit: 1
			}
		}
	});

	const locale = getLocale();

	const result = newsList.map(({ galleries, ...news }) => ({
		...news,

		title: locale === 'en' ? news.titleEn : news.title,

		content: locale === 'en' ? news.contentEn : news.content,

		mediaId: galleries[0]?.medium ?? null
	}));

	return {
		newsList: result
	};
}) satisfies PageServerLoad;
