<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	import CollapsibleContent from '$lib/components/CollapsibleContent.svelte';

	import FloatingImageContent from '$lib/components/FloatingImageContent.svelte';

	import TwoColumnContent from '$lib/components/TwoColumnContent.svelte';

	import historyImage from '$lib/assets/image-history.png';
</script>

<section class="bg-[#eef8ff]">
	<div
		class="
			mx-auto w-full
			px-4 py-10
			sm:px-6 sm:py-12
			md:px-8
			lg:px-10 lg:py-14
			xl:px-12
			2xl:px-16
		"
	>
		<!-- En-tête -->
		<header class="mb-6 lg:mb-8">
			<p
				class="
					text-xs font-bold tracking-[0.18em]
					text-primary
					uppercase
				"
			>
				{m.about_history_eyebrow()}
			</p>

			<div
				class="
					mt-3 h-0.75 w-10
					rounded-full bg-[#ef233c]
				"
			></div>

			<h2
				class="
					mt-4
					text-2xl leading-tight
					font-bold tracking-tight
					text-[#063b7c]

					sm:text-3xl
					lg:text-4xl
				"
			>
				{m.about_history_title()}
			</h2>
		</header>

		<!-- =====================================================
		     MOBILE < md
		     Image + résumé + collapsible
		     ===================================================== -->

		<div class="md:hidden">
			<img
				src={historyImage}
				alt={m.about_history_image_alt()}
				class="
					mb-5 aspect-16/10
					w-full rounded-lg
					object-cover
				"
			/>

			<CollapsibleContent
				summary={m.about_history_summary()}
				expandLabel={m.about_history_expand()}
				collapseLabel={m.about_history_collapse()}
			>
				<div class="space-y-4">
					<p>
						{m.about_history_paragraph_1()}
					</p>

					<p>
						{m.about_history_paragraph_2()}
					</p>
				</div>
			</CollapsibleContent>
		</div>

		<!-- =====================================================
		     TABLETTE + PETIT ORDINATEUR
		     md -> lg
		     Image flottante dans le texte
		     ===================================================== -->

		<div class="hidden md:block xl:hidden">
			<FloatingImageContent image={historyImage} imageAlt={m.about_history_image_alt()}>
				<div class="space-y-5">
					<p>
						{m.about_history_paragraph_1()}
					</p>

					<p>
						{m.about_history_paragraph_2()}
					</p>
				</div>
			</FloatingImageContent>
		</div>

		<!-- =====================================================
		     GRAND ÉCRAN >= xl
		     Deux colonnes
		     ===================================================== -->

		<div class="hidden xl:block">
			<TwoColumnContent
				image={historyImage}
				imageAlt={m.about_history_image_alt()}
				imagePosition="right"
			>
				<div class="space-y-6">
					<p>
						{m.about_history_paragraph_1()}
					</p>

					<p>
						{m.about_history_paragraph_2()}
					</p>
				</div>
			</TwoColumnContent>
		</div>
	</div>
</section>
