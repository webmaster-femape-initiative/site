<script lang="ts">
	import HeroImage from '$lib/components/HeroImage.svelte';

	import heroImage from '$lib/assets/donation-hero.png';

	import * as m from '$lib/paraglide/messages';
</script>

<section class="relative w-full overflow-hidden bg-base-100" aria-labelledby="donation-hero-title">
	<div class="mx-auto">
		<div class="grid md:grid-cols-2">
			<!-- =====================================================
			     IMAGE
			     ===================================================== -->

			<HeroImage image={heroImage} imageAlt={m.donation_hero_image_alt()} />

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
						{m.donation_hero_eyebrow()}
					</p>

					<!-- Titre -->

					<h1
						id="donation-hero-title"
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
						{m.donation_hero_title()}
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
						{m.donation_hero_subtitle()}
					</h2>

					<!-- Introduction -->

					<div
						class="
							mt-6

							max-w-2xl

							text-sm
							leading-relaxed
							text-primary/80

							sm:text-base

							lg:mt-7
							lg:text-lg
						"
					>
						<p>
							{m.donation_hero_description()}
						</p>
					</div>

					<!-- Accent -->

					<div
						class="
							mt-7
							h-1
							w-20
							rounded-full
							bg-secondary

							sm:w-24
						"
						aria-hidden="true"
					></div>
				</div>
			</div>
		</div>
	</div>
</section>
