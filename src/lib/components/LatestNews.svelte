<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

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

	/**
	 * Paraglide retourne par exemple "fr" ou "en".
	 */
	const locale = getLocale();
	/**
	 * Conversion vers une locale Intl complète.
	 *
	 * Cela permet notamment :
	 *
	 * fr -> 12 avril 2024
	 * en -> April 12, 2024
	 */
	const intlLocale = locale === 'en' ? 'en-US' : 'fr-FR';

	const formatDate = (date: Date | string) => {
		return new Intl.DateTimeFormat(intlLocale, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(new Date(date));
	};

	/**
	 * Permet de produire un extrait propre si content
	 * contient du HTML.
	 *
	 * Si ton contenu est déjà du texte brut, tu peux
	 * simplement utiliser news.content.
	 */
	const stripHtml = (html: string) => {
		return html
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	};
</script>

<section class="bg-base-100 py-8 lg:py-10">
	<div class="mx-auto w-full px-4 sm:px-6 lg:px-8">
		<!-- En-tête -->
		<div class="mb-5 flex items-end justify-between">
			<div>
				<h2 class="text-xl font-bold text-primary sm:text-2xl">{m.latestNews_title()}</h2>

				<div class="mt-2 h-0.75 w-8 rounded-full bg-red-500"></div>
			</div>

			<a
				href="#"
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
				<article
					class="
                        group overflow-hidden rounded-lg
                        border border-base-300 bg-base-100
                        shadow-sm transition
                        hover:-translate-y-0.5 hover:shadow-md
                    "
				>
					<!-- Image -->
					<a href="#" class="block overflow-hidden">
						{#if news.mediaId}
							<img
								src={`/api/media/${news.mediaId}`}
								alt={news.title}
								class="
                                    aspect-16/8 w-full object-cover
                                    transition-transform duration-300
                                    group-hover:scale-[1.02]
                                "
								loading="lazy"
							/>
						{:else}
							<div
								class="
                                    aspect-16/8 w-full
                                    bg-base-200
                                "
							></div>
						{/if}
					</a>

					<!-- Contenu -->
					<div class="flex flex-col p-4">
						<time
							datetime={new Date(news.createdAt).toISOString()}
							class="mb-1 text-xs text-base-content/60"
						>
							{formatDate(news.createdAt)}
						</time>

						<h3
							class="
                                mb-2 line-clamp-2
                                text-base leading-snug font-bold
                                text-primary
                            "
						>
							<a href="#">
								{news.title}
							</a>
						</h3>

						<p
							class="
                                mb-4 line-clamp-3
                                text-sm leading-relaxed
                                text-base-content/70
                            "
						>
							{stripHtml(news.content)}
						</p>

						<a
							href="#"
							class="
                                mt-auto inline-flex items-center gap-1
                                text-sm font-semibold text-[#1688e8]
                                transition-colors hover:text-primary
                            "
						>
							{m.latestNews_readMore()}
							<ArrowRight size={15} strokeWidth={2.2} />
						</a>
					</div>
				</article>
			{/each}
		</div>

		<!-- Lien mobile -->
		<div class="mt-5 flex justify-end sm:hidden">
			<a
				href="#"
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
