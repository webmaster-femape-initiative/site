<script lang="ts">
	import { HandHeart, Ear, Sprout } from '@lucide/svelte';

	import HeroImage from '$lib/components/HeroImage.svelte';

	import heroImage from '$lib/assets/program-hero.png';

	import * as m from '$lib/paraglide/messages';

	const commitments = [
		{
			title: m.programs_hero_support_title(),
			description: m.programs_hero_support_description(),
			icon: HandHeart,
			bgClass: 'bg-primary'
		},
		{
			title: m.programs_hero_listen_title(),
			description: m.programs_hero_listen_description(),
			icon: Ear,
			bgClass: 'bg-secondary'
		},
		{
			title: m.programs_hero_rebuild_title(),
			description: m.programs_hero_rebuild_description(),
			icon: Sprout,
			bgClass: 'bg-sky-500'
		}
	];
</script>

<section class="relative w-full overflow-hidden bg-base-100" aria-labelledby="programs-hero-title">
	<div class="mx-auto">
		<div class="grid md:grid-cols-2">
			<!-- =====================================================
			     IMAGE
			     ===================================================== -->

			<HeroImage image={heroImage} imageAlt={m.programs_hero_image_alt()} />

			<!-- =====================================================
			     CONTENU
			     ===================================================== -->

			<div
				class="
					order-2
					flex items-center

					px-5 py-8

					sm:px-8
					sm:py-10

					md:order-1
					md:px-8
					md:py-12

					lg:px-12

					xl:px-14

					2xl:px-16
				"
			>
				<div class="w-full">
					<!-- Eyebrow -->

					<p
						class="
							mb-2
							text-xs
							font-bold
							tracking-wide
							text-secondary
							uppercase

							sm:text-sm
						"
					>
						{m.programs_hero_eyebrow()}
					</p>

					<!-- Titre -->

					<h1
						id="programs-hero-title"
						class="
						
							text-3xl
							leading-[1.05]
							font-bold
							text-primary

							sm:text-4xl
							md:text-4xl
							lg:text-5xl
							xl:text-5xl
							2xl:text-6xl
						"
					>
						{m.programs_hero_title()}
					</h1>

					<!-- Sous-titre -->

					<h2
						class="
							mt-2

							text-xl
							leading-tight
							text-sky-500

							sm:text-2xl
							lg:text-3xl
						"
					>
						{m.programs_hero_subtitle()}
					</h2>

					<!-- Introduction -->

					<div
						class="
							mt-6
							space-y-3

							text-sm
							leading-relaxed
							text-primary/80

							sm:text-base
							lg:mt-7
						"
					>
						<p>
							{m.programs_hero_intro()}
						</p>

						<p>
							{m.programs_hero_goal()}
						</p>
					</div>

					<!-- =================================================
					     ENGAGEMENTS
					     ================================================= -->

					<div
						class="
		mt-7
		grid grid-cols-1 gap-4

		sm:grid-cols-3
		sm:gap-3

		lg:mt-9
		lg:gap-5
	"
					>
						{#each commitments as commitment (commitment.icon)}
							<div
								class="
				flex items-center gap-3

				sm:flex-col
				sm:items-start
				sm:gap-2

				lg:flex-row
				lg:items-start
				lg:gap-3
			"
							>
								<div
									class="
					{commitment.bgClass}

					flex
					size-11
					shrink-0
					items-center
					justify-center

					rounded-full
					text-white
					shadow-sm

					lg:size-12
				"
								>
									<commitment.icon size={23} strokeWidth={2} aria-hidden="true" />
								</div>

								<div class="min-w-0">
									<h3
										class="
						text-sm
						leading-tight
						font-bold
						text-primary

						sm:text-xs
						lg:text-sm
					"
									>
										{commitment.title}
									</h3>

									<p
										class="
						mt-1
						max-w-[180px]

						text-xs
						leading-snug
						text-primary/70

						lg:text-sm
					"
									>
										{commitment.description}
									</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
