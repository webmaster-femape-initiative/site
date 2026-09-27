import { db } from '$lib/server/db';
import { news, newsCategories } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

import { getLocale } from '$lib/paraglide/runtime';

import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';

const PAGE_SIZE = 9;

export const load = (async ({ url }) => {
	const locale = getLocale();

	/*
	 * Paramètres de recherche
	 */
	const search = url.searchParams.get('q')?.trim() ?? '';
	const category = url.searchParams.get('category') ?? '';
	const sort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'latest';

	/*
	 * Pagination
	 */
	const requestedPage = Number(url.searchParams.get('page') ?? '1');

	const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

	/*
	 * Construction des filtres.
	 */
	const filters = [];

	if (search) {
		const searchFilter =
			locale === 'en'
				? or(ilike(news.titleEn, `%${search}%`), ilike(news.contentEn, `%${search}%`))
				: or(ilike(news.title, `%${search}%`), ilike(news.content, `%${search}%`));

		if (searchFilter) {
			filters.push(searchFilter);
		}
	}

	/*
	 * Filtrage par catégorie.
	 *
	 * On récupère les IDs des actualités appartenant à
	 * la catégorie sélectionnée.
	 */
	if (category) {
		const categorizedNews = await db
			.select({
				newsId: newsCategories.news
			})
			.from(newsCategories)
			.where(eq(newsCategories.category, category));

		filters.push(
			inArray(
				news.id,
				categorizedNews.map((item) => item.newsId)
			)
		);
	}

	const where = filters.length > 0 ? and(...filters) : undefined;

	/*
	 * Nombre total d'actualités après filtrage.
	 */
	const [{ total }] = await db
		.select({
			total: count()
		})
		.from(news)
		.where(where);

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const currentPage = Math.min(page, totalPages);

	/*
	 * Actualités de la page courante.
	 */
	const newsList = await db.query.news.findMany({
		where,

		limit: PAGE_SIZE,

		offset: (currentPage - 1) * PAGE_SIZE,

		orderBy: (news) => (sort === 'oldest' ? asc(news.createdAt) : desc(news.createdAt)),

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

	/*
	 * Catégories disponibles pour le filtre.
	 */
	const categories = await db.query.categories.findMany({
		orderBy: (categories, { asc }) => asc(categories.name)
	});

	/*
	 * Localisation du contenu.
	 */
	const result = newsList.map(({ galleries, ...news }) => ({
		...news,

		title: locale === 'en' ? news.titleEn : news.title,

		content: locale === 'en' ? news.contentEn : news.content,

		mediaId: galleries[0]?.medium ?? null
	}));

	return {
		newsList: result,

		categories,

		filters: {
			search,
			category,
			sort
		},

		pagination: {
			page: currentPage,
			pageSize: PAGE_SIZE,
			total,
			totalPages
		}
	};
}) satisfies PageServerLoad;
