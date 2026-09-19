import type { PageServerLoad } from './$types';

export const load = (async () => {
	const newsList = await db.query.news.findMany({
		where: and(
			search ? ilike(news.title, '%' + search + '%') : undefined,
			author ? eq(news.author, author) : undefined,
			category
				? inArray(
						news.id,
						db
							.select({ id: newsCategories.news })
							.from(newsCategories)
							.innerJoin(categories, eq(newsCategories.category, categories.id))
							.where(eq(categories.id, category))
					)
				: undefined
		),
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
			}
		}
	});

	return {};
}) satisfies PageServerLoad;
