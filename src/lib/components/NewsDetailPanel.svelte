<script lang="ts">
	import { CalendarDays, ChevronRight } from '@lucide/svelte';

	import { getLocale, localizeHref } from '$lib/paraglide/runtime';

	import * as m from '$lib/paraglide/messages';

	type News = {
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

	const formattedDate = $derived(
		new Intl.DateTimeFormat(intlLocale, {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(new Date(news.createdAt))
	);

	const homeHref = localizeHref('/');
	const newsHref = localizeHref('/news');
</script>

<!-- =============================================================
     Fil d'Ariane
     ============================================================= -->

<nav
	aria-label={m.newsDetail_breadcrumb()}
	class="
        mb-7 flex items-center gap-1.5
        overflow-hidden
        text-sm text-base-content/55
        sm:mb-9
    "
>
	<a
		href={homeHref}
		class="
            shrink-0
            transition-colors hover:text-primary
        "
	>
		{m.newsDetail_home()}
	</a>

	<ChevronRight size={15} strokeWidth={1.8} class="shrink-0 text-base-content/35" />

	<a
		href={newsHref}
		class="
            shrink-0
            transition-colors hover:text-primary
        "
	>
		{m.newsDetail_news()}
	</a>

	<ChevronRight
		size={15}
		strokeWidth={1.8}
		class="
            hidden shrink-0
            text-base-content/35
            sm:block
        "
	/>

	<span
		aria-current="page"
		class="
            hidden min-w-0 truncate
            text-base-content/55
            sm:block
        "
	>
		{news.title}
	</span>
</nav>

<!-- =============================================================
     Article
     ============================================================= -->

<article>
	<!-- =========================================================
         En-tête
         ========================================================= -->

	<header class="mb-6 sm:mb-8">
		<h1
			class="
                text-3xl leading-tight font-bold
                text-primary
                sm:text-4xl
                lg:text-5xl
            "
		>
			{news.title}
		</h1>

		<!-- Date -->

		<div
			class="
                mt-4 flex flex-wrap items-center
                gap-x-5 gap-y-2
                text-sm text-base-content/60
                sm:text-base
            "
		>
			<time datetime={new Date(news.createdAt).toISOString()} class="flex items-center gap-2">
				<CalendarDays size={17} strokeWidth={1.8} class="text-primary" />

				{formattedDate}
			</time>
		</div>
	</header>

	<!-- =========================================================
         Image principale
         ========================================================= -->

	{#if news.mediaId}
		<figure
			class="
                mb-8 overflow-hidden
                rounded-lg bg-base-200
                sm:mb-10 sm:rounded-xl
            "
		>
			<img
				src={`/api/media/${news.mediaId}`}
				alt={news.title}
				class="
                    aspect-[16/9] w-full
                    object-cover
                "
			/>
		</figure>
	{/if}

	<!-- =========================================================
         Contenu
         ========================================================= -->

	<div
		class="
            prose prose-base max-w-none
            sm:prose-lg

            prose-headings:font-bold
            prose-headings:text-primary

            prose-h2:mt-10
            prose-h2:mb-4

            prose-h3:mt-8
            prose-h3:mb-3

            prose-p:text-base-content/75

            prose-a:font-medium
            prose-a:text-[#1688e8]
            prose-a:no-underline
            hover:prose-a:underline

            prose-blockquote:border-primary
            prose-blockquote:text-base-content/70

            prose-strong:font-bold
            prose-strong:text-primary

            prose-li:text-base-content/75

            prose-img:rounded-lg
        "
	>
		{@html news.content}
	</div>
</article>
