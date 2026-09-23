<script lang="ts">
	import { Home, UsersRound, Heart } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	/**
	 * À adapter à l'emplacement réel de ton image.
	 * Si elle est dans /static/images/programs/hero.webp,
	 * cette URL est correcte telle quelle.
	 */
	const heroImage = '/assets/images/program-hero.png';

	const commitments = [
		{
			label: m.programs_hero_daily_help(),
			icon: Home,
			bgClass: 'bg-primary'
		},
		{
			label: m.programs_hero_reintegration(),
			icon: UsersRound,
			bgClass: 'bg-secondary'
		},
		{
			label: m.programs_hero_psychological_support(),
			icon: Heart,
			bgClass: 'bg-sky-500'
		}
	];
</script>

<section class="relative w-full overflow-hidden bg-base-100" aria-labelledby="programs-hero-title">
	<div class="mx-auto max-w-screen-2xl">
		<!--
			Mobile :
			image puis contenu.

			md+ :
			2 colonnes avec texte à gauche et image à droite.
		-->
		<div class="grid md:grid-cols-2">
			<!-- IMAGE
			     Sur mobile elle passe avant le contenu.
			     À partir de md elle passe à droite.
			-->
			<div
				class="
					relative
					order-1
					h-[260px]
					sm:h-[340px]
					md:order-2
					md:h-auto
					md:min-h-[500px]
					lg:min-h-[540px]
					xl:min-h-[580px]
				"
			>
				<img
					src={heroImage}
					alt={m.programs_hero_image_alt()}
					class="absolute inset-0 h-full w-full object-cover object-center"
				/>

				<!--
					Léger fondu vers le contenu.
					Particulièrement utile à la jonction des deux colonnes.
				-->
				<div
					class="
						pointer-events-none
						absolute
						inset-0
						bg-gradient-to-t
						from-base-100/20
						to-transparent
						md:bg-gradient-to-r
						md:from-base-100/30
						md:via-transparent
						md:to-transparent
					"
				></div>

				<!-- Accroche décorative -->
				<div
					class="
						absolute
						top-5
						right-5
						hidden
						max-w-[150px]
						rotate-[-5deg]
						text-right
						xl:block
					"
					aria-hidden="true"
				>
					<p
						class="
							leading-snug
							font-semibold
							text-primary
							italic
							xl:text-xl
							2xl:text-2xl
						"
					>
						{m.programs_hero_slogan()}
					</p>

					<div
						class="
							mt-3
							ml-auto
							h-1
							w-14
							rotate-[-8deg]
							rounded-full
							bg-secondary
						"
					></div>
				</div>
			</div>

			<!-- CONTENU -->
			<div
				class="
					order-2
					flex
					items-center
					px-5
					py-8
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
							max-w-2xl
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
							max-w-xl
							text-xl
							leading-tight
							font-bold
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
							max-w-xl
							space-y-3
							text-sm
							leading-relaxed
							text-base-content/80
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

					<!-- Engagements -->
					<div
						class="
							mt-7
							grid
							grid-cols-1
							gap-4
							sm:grid-cols-3
							sm:gap-3
							lg:mt-9
							lg:gap-5
						"
					>
						{#each commitments as commitment (commitment.icon)}
							<div
								class="
									flex
									items-center
									gap-3
									sm:items-start
									sm:gap-2
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

								<p
									class="
										max-w-[170px]
										text-sm
										leading-snug
										font-semibold
										text-primary
										sm:text-xs
										lg:text-sm
									"
								>
									{commitment.label}
								</p>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
