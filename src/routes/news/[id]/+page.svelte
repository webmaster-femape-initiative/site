<script lang="ts">
	import backgroundImage from '$lib/assets/news-detail-background.png';
	import NewsDetailPanel from '$lib/components/NewsDetailPanel.svelte';
	import NewsGallery from '$lib/components/NewsGallery.svelte';
	import RelatedNews from '$lib/components/RelatedNews.svelte';
	import * as m from '$lib/paraglide/messages';
	let { data } = $props();
</script>

<div
	class="
        relative overflow-hidden
        bg-cover bg-top bg-no-repeat
        lg:bg-fixed
    "
	style:background-image={`url(${backgroundImage})`}
>
	<!-- =========================================================
         Voile sur l'image de fond
         ========================================================= -->

	<div
		class="
            pointer-events-none absolute inset-0
            bg-white/30
        "
		aria-hidden="true"
	></div>

	<!-- =========================================================
         Contenu
         ========================================================= -->

	<section
		class="
            relative z-10
            py-8
            sm:py-10
            lg:py-12
            xl:py-14
        "
	>
		<!-- =====================================================
             Surface blanche centrale
             ===================================================== -->

		<div
			class="
                mx-auto w-full
                bg-white

                px-4 py-6

                sm:px-6 sm:py-8

                lg:px-8 lg:py-10

                xl:max-w-[1536px]
                xl:rounded-2xl
                xl:px-10 xl:py-10
                xl:shadow-sm

                2xl:px-12
            "
		>
			<!-- =================================================
                 Grille principale
                 ================================================= -->

			<div
				class="
                    grid grid-cols-1
                    gap-10

                    xl:grid-cols-[minmax(0,1fr)_340px]
                    xl:items-start
                    xl:gap-12

                    2xl:grid-cols-[minmax(0,1fr)_380px]
                    2xl:gap-14
                "
			>
				<!-- =============================================
                     Article
                     ============================================= -->

				<main class="min-w-0">
					<NewsDetailPanel news={data.news} />
				</main>

				<!-- =============================================
                     Sidebar
                     ============================================= -->

				<aside
					class="
                        min-w-0

                        border-t border-base-300
                        pt-8

                        xl:border-t-0
                        xl:border-l
                        xl:pt-0
                        xl:pl-8

                        2xl:pl-10
                    "
				>
					<!-- =========================================
                         Galerie
                         ========================================= -->

					{#if data.news.gallery.length > 0}
						<section>
							<header class="mb-5">
								<h2 class="text-xl font-bold text-primary sm:text-2xl">{m.newsDetail_gallery()}</h2>

								<div class="mt-2 h-0.75 w-10 rounded-full bg-red-500"></div>
							</header>

							<NewsGallery images={data.news.gallery} />
						</section>
					{/if}

					<!-- =========================================
                         Articles connexes
                         ========================================= -->

					{#if data.relatedNews.length > 0}
						<section
							class="
            mt-10
            border-t border-base-300
            pt-8
        "
						>
							<header class="mb-5">
								<h2 class="text-xl font-bold text-primary sm:text-2xl">
									{m.newsDetail_relatedNews()}
								</h2>

								<div
									class="
                    mt-2 h-0.75 w-10
                    rounded-full bg-red-500
                "
								></div>
							</header>

							<RelatedNews newsList={data.relatedNews} />
						</section>
					{/if}
				</aside>
			</div>
		</div>
	</section>
</div>
