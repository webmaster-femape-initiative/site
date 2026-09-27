<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';

	import * as m from '$lib/paraglide/messages';
	import { localizeHref } from '$lib/paraglide/runtime';
	import NewsCard from './NewsCard.svelte';

	type News = {
		id: string;
		title: string;
		content: string;
		createdAt: Date | string;
		mediaId: string | null;
	};

	let {
		newsList
	}: {
		newsList: News[];
	} = $props();

	const newsHref = localizeHref('/news');
</script>

<section class="bg-base-100 py-8 lg:py-10">
	<div class="mx-auto w-full px-4 sm:px-6 lg:px-8">
		<!-- En-tête -->
		<div class="mb-5 flex items-end justify-between">
			<div>
				<h2 class="text-xl font-bold text-primary sm:text-2xl">
					{m.latestNews_title()}
				</h2>

				<div class="mt-2 h-0.75 w-8 rounded-full bg-red-500"></div>
			</div>

			<a
				href={newsHref}
				class="
                    hidden items-center gap-1
                    text-sm font-medium text-[#1688e8]
                    transition-colors hover:text-primary
                    sm:flex
                "
			>
				{m.latestNews_viewAll()}
				<ArrowRight size={16} strokeWidth={2} />
			</a>
		</div>

		<!-- Actualités -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each newsList as news (news.id)}
				<NewsCard {news} />
			{/each}
		</div>

		<!-- Lien mobile -->
		<div class="mt-5 flex justify-end sm:hidden">
			<a
				href={newsHref}
				class="
                    inline-flex items-center gap-1
                    text-sm font-medium text-[#1688e8]
                "
			>
				{m.latestNews_viewAll()}
				<ArrowRight size={16} />
			</a>
		</div>
	</div>
</section>
