<script lang="ts">
	import { ArrowRight } from '@lucide/svelte';

	import * as m from '$lib/paraglide/messages';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';

	type News = {
		id: string;
		title: string;
		content: string;
		createdAt: Date | string;
		mediaId: string | null;
	};

	let {
		news
	}: {
		news: News;
	} = $props();

	const locale = getLocale();

	const intlLocale = locale === 'en' ? 'en-US' : 'fr-FR';

	const formatDate = (date: Date | string) => {
		return new Intl.DateTimeFormat(intlLocale, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}).format(new Date(date));
	};

	const stripHtml = (html: string) => {
		return html
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	};

	const href = localizeHref(`/news/${news.id}`);
</script>

<article
	class="
        group overflow-hidden rounded-lg
        border border-base-300 bg-base-100
        shadow-sm transition
        hover:-translate-y-0.5 hover:shadow-md
    "
>
	<!-- Image -->
	<a {href} class="block overflow-hidden">
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
			<div class="aspect-16/8 w-full bg-base-200"></div>
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
			<a {href}>
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
			{href}
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
