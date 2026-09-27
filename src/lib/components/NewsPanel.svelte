<script lang="ts">
	import { Search, ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';

	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	import NewsCard from './NewsCard.svelte';

	type News = {
		id: string;
		title: string;
		content: string;
		createdAt: Date | string;
		mediaId: string | null;
	};

	type Category = {
		id: string;
		name: string;
	};

	type Filters = {
		search: string;
		category: string;
		sort: 'latest' | 'oldest';
	};

	type Pagination = {
		page: number;
		pageSize: number;
		total: number;
		totalPages: number;
	};

	let {
		newsList,
		categories,
		filters,
		pagination
	}: {
		newsList: News[];
		categories: Category[];
		filters: Filters;
		pagination: Pagination;
	} = $props();

	/**
	 * Génère le lien d'une page en conservant
	 * les filtres actuellement sélectionnés.
	 */
	const pageHref = (page: number) => {
		const params = new SvelteURLSearchParams();

		if (filters.search) {
			params.set('q', filters.search);
		}

		if (filters.category) {
			params.set('category', filters.category);
		}

		if (filters.sort !== 'latest') {
			params.set('sort', filters.sort);
		}

		if (page > 1) {
			params.set('page', String(page));
		}

		const query = params.toString();

		return localizeHref(query ? `/news?${query}` : '/news');
	};

	/**
	 * Pages affichées dans la pagination.
	 *
	 * Exemple :
	 *
	 * 1 2 3 4 ... 10
	 * 1 ... 4 5 6 ... 10
	 * 1 ... 7 8 9 10
	 */
	const visiblePages = $derived.by(() => {
		const { page, totalPages } = pagination;

		if (totalPages <= 5) {
			return Array.from({ length: totalPages }, (_, index) => index + 1);
		}

		if (page <= 3) {
			return [1, 2, 3, 4, totalPages];
		}

		if (page >= totalPages - 2) {
			return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
		}

		return [1, page - 1, page, page + 1, totalPages];
	});
</script>

<section class="bg-base-100 py-8 lg:py-10">
	<div class="mx-auto w-full px-4 sm:px-6 lg:px-8">
		<!-- =====================================================
             En-tête
             ===================================================== -->

		<div class="mb-6">
			<h1
				class="
                    text-2xl font-bold text-primary
                    sm:text-3xl
                "
			>
				{m.newsPage_title()}
			</h1>

			<div
				class="
                    mt-2 h-0.75 w-8
                    rounded-full bg-red-500
                "
			></div>

			<p
				class="
                    mt-4 max-w-2xl
                    text-sm leading-relaxed
                    text-base-content/70
                    sm:text-base
                "
			>
				{m.newsPage_description()}
			</p>
		</div>

		<!-- =====================================================
             Recherche et filtres
             ===================================================== -->

		<form
			method="GET"
			action={localizeHref('/news')}
			class="
                mb-7 grid grid-cols-1 gap-3

                sm:grid-cols-2

                lg:grid-cols-[minmax(0,1fr)_220px_190px_auto]
                lg:gap-4
            "
		>
			<!-- Recherche -->

			<label
				class="
                    flex h-11 items-center gap-3

                    rounded-lg
                    border border-base-300
                    bg-base-100
                    px-4

                    transition-colors
                    focus-within:border-primary

                    sm:col-span-2
                    lg:col-span-1
                "
			>
				<Search size={18} strokeWidth={2} class="shrink-0 text-primary" />

				<input
					type="search"
					name="q"
					value={filters.search}
					aria-label={m.newsPage_searchLabel()}
					placeholder={m.newsPage_searchPlaceholder()}
					class="
                        min-w-0 flex-1
                        bg-transparent

                        text-sm
                        text-base-content

                        outline-none

                        placeholder:text-base-content/40
                    "
				/>
			</label>

			<!-- Catégorie -->

			<select
				name="category"
				aria-label={m.newsPage_categoryLabel()}
				class="
                    h-11 w-full

                    rounded-lg
                    border border-base-300
                    bg-base-100
                    px-4

                    text-sm font-medium
                    text-primary

                    transition-colors
                    outline-none

                    hover:border-primary/40
                    focus:border-primary
                "
			>
				<option value="">
					{m.newsPage_allCategories()}
				</option>

				{#each categories as category}
					<option value={category.id} selected={filters.category === category.id}>
						{category.name}
					</option>
				{/each}
			</select>

			<!-- Tri -->

			<select
				name="sort"
				aria-label={m.newsPage_sortLabel()}
				class="
                    h-11 w-full

                    rounded-lg
                    border border-base-300
                    bg-base-100
                    px-4

                    text-sm font-medium
                    text-primary

                    transition-colors
                    outline-none

                    hover:border-primary/40
                    focus:border-primary
                "
			>
				<option value="latest" selected={filters.sort === 'latest'}>
					{m.newsPage_sortLatest()}
				</option>

				<option value="oldest" selected={filters.sort === 'oldest'}>
					{m.newsPage_sortOldest()}
				</option>
			</select>

			<!-- Validation -->

			<button
				type="submit"
				class="
                    h-11
                    rounded-lg
                    bg-primary
                    px-5

                    text-sm font-semibold
                    text-primary-content

                    transition-opacity
                    hover:opacity-90

                    sm:col-span-2
                    lg:col-span-1
                "
			>
				{m.newsPage_filter()}
			</button>
		</form>

		<!-- =====================================================
             Actualités
             ===================================================== -->

		<div
			class="
                grid grid-cols-1 gap-4

                sm:grid-cols-2

                lg:grid-cols-3
                lg:gap-5
            "
		>
			{#each newsList as news (news.id)}
				<NewsCard {news} />
			{/each}
		</div>

		<!-- =====================================================
             Pagination
             ===================================================== -->

		{#if pagination.totalPages > 1}
			<nav
				aria-label={m.newsPage_paginationLabel()}
				class="
                    mt-8 flex
                    items-center justify-center
                    gap-1

                    sm:mt-10
                "
			>
				<!-- Page précédente -->

				{#if pagination.page > 1}
					<a
						href={pageHref(pagination.page - 1)}
						aria-label={m.newsPage_previousPage()}
						class="
                            flex size-9
                            items-center justify-center

                            rounded-full
                            border border-base-300

                            text-primary

                            transition-colors

                            hover:border-primary
                            hover:bg-base-200
                        "
					>
						<ChevronLeft size={18} strokeWidth={2} />
					</a>
				{:else}
					<span
						aria-hidden="true"
						class="
                            flex size-9
                            items-center justify-center

                            rounded-full
                            border border-base-300

                            text-base-content/25
                        "
					>
						<ChevronLeft size={18} strokeWidth={2} />
					</span>
				{/if}

				<!-- Pages -->

				{#each visiblePages as page, index (page)}
					{#if index > 0 && page - visiblePages[index - 1] > 1}
						<span
							aria-hidden="true"
							class="
                                flex size-9
                                items-center justify-center

                                text-sm
                                text-base-content/50
                            "
						>
							…
						</span>
					{/if}

					{#if page === pagination.page}
						<span
							aria-current="page"
							aria-label={m.newsPage_currentPage({ page })}
							class="
                                flex size-9
                                items-center justify-center

                                rounded-full
                                bg-primary

                                text-sm font-semibold
                                text-primary-content
                            "
						>
							{page}
						</span>
					{:else}
						<a
							href={pageHref(page)}
							aria-label={m.newsPage_goToPage({ page })}
							class="
                                flex size-9
                                items-center justify-center

                                rounded-full

                                text-sm font-medium
                                text-primary

                                transition-colors
                                hover:bg-base-200
                            "
						>
							{page}
						</a>
					{/if}
				{/each}

				<!-- Page suivante -->

				{#if pagination.page < pagination.totalPages}
					<a
						href={pageHref(pagination.page + 1)}
						aria-label={m.newsPage_nextPage()}
						class="
                            flex size-9
                            items-center justify-center

                            rounded-full
                            border border-base-300

                            text-primary

                            transition-colors

                            hover:border-primary
                            hover:bg-base-200
                        "
					>
						<ChevronRight size={18} strokeWidth={2} />
					</a>
				{:else}
					<span
						aria-hidden="true"
						class="
                            flex size-9
                            items-center justify-center

                            rounded-full
                            border border-base-300

                            text-base-content/25
                        "
					>
						<ChevronRight size={18} strokeWidth={2} />
					</span>
				{/if}
			</nav>
		{/if}
	</div>
</section>
