<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';

	import { getLocale, localizeHref } from '$lib/paraglide/runtime';

	import * as m from '$lib/paraglide/messages';

	type RelatedNews = {
		id: string;
		title: string;
		createdAt: Date | string;
		mediaId: string | null;
	};

	let {
		newsList
	}: {
		newsList: RelatedNews[];
	} = $props();

	const locale = getLocale();

	const intlLocale = locale === 'en' ? 'en-US' : 'fr-FR';

	const formatDate = (date: Date | string) =>
		new Intl.DateTimeFormat(intlLocale, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(new Date(date));
</script>

<div class="divide-y divide-base-300">
	{#each newsList as news (news.id)}
		<article class="py-4 first:pt-0 last:pb-0">
			<a
				href={localizeHref(`/news/${news.id}`)}
				class="
                    group grid
                    grid-cols-[96px_minmax(0,1fr)]
                    gap-4
                "
			>
				<!-- Image -->

				<div
					class="
                        aspect-4/3
                        overflow-hidden
                        rounded-lg
                        bg-base-200
                    "
				>
					{#if news.mediaId}
						<img
							src={`/api/media/${news.mediaId}`}
							alt=""
							loading="lazy"
							class="
                                size-full
                                object-cover

                                transition-transform
                                duration-300

                                group-hover:scale-105
                            "
						/>
					{/if}
				</div>

				<!-- Texte -->

				<div class="min-w-0">
					<time
						datetime={new Date(news.createdAt).toISOString()}
						class="
                            block
                            text-xs
                            text-base-content/50
                        "
					>
						{formatDate(news.createdAt)}
					</time>

					<h3
						class="
                            mt-1
                            line-clamp-3

                            text-sm leading-snug
                            font-semibold
                            text-primary

                            transition-colors

                            group-hover:text-[#1688e8]

                            sm:text-base
                        "
					>
						{news.title}
					</h3>

					<span
						class="
                            mt-2
                            inline-flex items-center gap-1

                            text-xs font-semibold
                            text-[#1688e8]
                        "
					>
						{m.newsDetail_readMore()}

						<ArrowRight
							size={13}
							strokeWidth={2}
							class="
                                transition-transform
                                group-hover:translate-x-0.5
                            "
						/>
					</span>
				</div>
			</a>
		</article>
	{/each}
</div>
