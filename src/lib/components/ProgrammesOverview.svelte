<script lang="ts">
	import { House, UsersRound, Heart, HandHeart } from '@lucide/svelte';

	import ResponsiveActionCard from '$lib/components/ResponsiveActionCard.svelte';

	import vulnerableImage from '$lib/assets/assistance.png';
	import reintegrationImage from '$lib/assets/reinsertion.png';
	import psychologicalImage from '$lib/assets/psychological.png';
	import homelessImage from '$lib/assets/aide-sans-abris.png';

	import * as m from '$lib/paraglide/messages';
</script>

<section
	class="
		bg-base-100
		px-5 py-10

		sm:px-8

		md:py-12

		lg:px-12

		xl:px-16
		xl:py-16
	"
	aria-labelledby="programs-title"
>
	<div class="mx-auto">
		<!-- =====================================================
		     EN-TÊTE
		     ===================================================== -->

		<header>
			<h2
				id="programs-title"
				class="
					text-3xl
					leading-tight
					font-bold
					text-primary

					md:text-4xl
					xl:text-5xl
				"
			>
				{m.programs_title()}
			</h2>

			<div class="mt-3 h-1 w-12 rounded-full bg-secondary" aria-hidden="true"></div>

			<p
				class="
					mt-5
				
					text-base
					leading-relaxed
					text-primary/80

					md:text-lg
				"
			>
				{m.programs_intro()}
			</p>
		</header>

		<!-- =====================================================
		     PROGRAMMES

		     mobile : 1 colonne
		     md/lg  : 2 colonnes
		     xl+    : 4 colonnes
		     ===================================================== -->

		<div
			class="
				mt-8

				grid
				grid-cols-1
				gap-4

				md:grid-cols-2
				md:gap-5

				xl:mt-10
				xl:grid-cols-4
				xl:gap-6

				2xl:gap-7
			"
		>
			<!-- ===============================================
			     01 — PERSONNES VULNÉRABLES
			     =============================================== -->

			<ResponsiveActionCard
				title={m.programs_vulnerable_title()}
				description={m.programs_vulnerable_summary()}
				image={vulnerableImage}
				imageAlt={m.programs_vulnerable_image_alt()}
				ctaLabel={m.programs_discover()}
				ctaHref="#assistance-personnes-vulnerables"
				ctaClass="text-primary"
			>
				{#snippet icon()}
					<div
						class="
							flex
							size-11
							shrink-0
							items-center
							justify-center

							rounded-full
							bg-primary
							text-primary-content
							shadow-sm

							lg:size-12
						"
					>
						<House size={23} strokeWidth={2.2} aria-hidden="true" />
					</div>
				{/snippet}
			</ResponsiveActionCard>

			<!-- ===============================================
			     02 — RÉINSERTION
			     =============================================== -->

			<ResponsiveActionCard
				title={m.programs_reintegration_title()}
				description={m.programs_reintegration_summary()}
				image={reintegrationImage}
				imageAlt={m.programs_reintegration_image_alt()}
				ctaLabel={m.programs_discover()}
				ctaHref="#reinsertion-sociale-professionnelle"
				ctaClass="text-secondary"
			>
				{#snippet icon()}
					<div
						class="
							flex
							size-11
							shrink-0
							items-center
							justify-center

							rounded-full
							bg-secondary
							text-secondary-content
							shadow-sm

							lg:size-12
						"
					>
						<UsersRound size={23} strokeWidth={2.2} aria-hidden="true" />
					</div>
				{/snippet}
			</ResponsiveActionCard>

			<!-- ===============================================
			     03 — SOUTIEN PSYCHOLOGIQUE
			     =============================================== -->

			<ResponsiveActionCard
				title={m.programs_psychological_title()}
				description={m.programs_psychological_summary()}
				image={psychologicalImage}
				imageAlt={m.programs_psychological_image_alt()}
				ctaLabel={m.programs_discover()}
				ctaHref="#soutien-psychologique"
				ctaClass="text-sky-500"
			>
				{#snippet icon()}
					<div
						class="
							flex
							size-11
							shrink-0
							items-center
							justify-center

							rounded-full
							bg-sky-500
							text-white
							shadow-sm

							lg:size-12
						"
					>
						<Heart size={23} strokeWidth={2.2} aria-hidden="true" />
					</div>
				{/snippet}
			</ResponsiveActionCard>

			<!-- ===============================================
			     04 — AIDE AUX PERSONNES SANS-ABRI
			     =============================================== -->

			<ResponsiveActionCard
				title={m.programs_homeless_title()}
				description={m.programs_homeless_summary()}
				image={homelessImage}
				imageAlt={m.programs_homeless_image_alt()}
				ctaLabel={m.programs_discover()}
				ctaHref="#aide-personnes-sans-abri"
				ctaClass="text-amber-600"
			>
				{#snippet icon()}
					<div
						class="
							flex
							size-11
							shrink-0
							items-center
							justify-center

							rounded-full
							bg-amber-500
							text-white
							shadow-sm

							lg:size-12
						"
					>
						<HandHeart size={23} strokeWidth={2.2} aria-hidden="true" />
					</div>
				{/snippet}
			</ResponsiveActionCard>
		</div>
	</div>
</section>
