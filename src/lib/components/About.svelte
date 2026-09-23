<script lang="ts">
	import { UsersRound, Ear, Sprout } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	// Adapte simplement le chemin à ton projet.
	import aboutHero from '$lib/assets/about-hero.png';

	const values = [
		{
			icon: UsersRound,
			title: m.about_value_dignity_title,
			description: m.about_value_dignity_description,
			iconClass: 'bg-primary'
		},
		{
			icon: Ear,
			title: m.about_value_listening_title,
			description: m.about_value_listening_description,
			iconClass: 'bg-secondary'
		},
		{
			icon: Sprout,
			title: m.about_value_autonomy_title,
			description: m.about_value_autonomy_description,
			iconClass: 'bg-sky-400'
		}
	];
</script>

<section class="relative w-full overflow-hidden bg-white">
	<!--
		Image uniquement à partir du breakpoint lg.
		Elle occupe la partie droite et se fond progressivement
		dans le fond blanc vers la gauche et vers le bas.
	-->
	<div
		class="pointer-events-none absolute inset-y-0 right-0 hidden w-[52%] lg:block"
		aria-hidden="true"
	>
		<img
			src={aboutHero}
			alt=""
			class="h-full w-full object-cover lg:object-right 2xl:object-center"
		/>

		<!-- Fondu horizontal vers le texte -->
		<div
			class="absolute inset-0
				bg-[linear-gradient(to_right,white_0%,rgba(255,255,255,0.96)_8%,rgba(255,255,255,0.45)_38%,rgba(255,255,255,0)_70%)]"
		></div>

		<!-- Fondu inférieur -->
		<div
			class="absolute inset-0
				bg-[linear-gradient(to_bottom,transparent_55%,rgba(255,255,255,0.95)_100%)]"
		></div>
	</div>

	<div
		class="
			relative z-10 mx-auto w-full
			max-w-7xl px-4
			py-8 sm:px-6
			sm:py-10 md:px-8
			lg:px-10
			lg:py-12 xl:max-w-none
			xl:px-12 xl:py-14
			2xl:px-16
		"
	>
		<!-- Fil d'Ariane -->
		<div class="mb-6 text-xs text-primary sm:text-sm">
			<span>{m.about_breadcrumb_home()}</span>
			<span class="mx-1.5">/</span>
			<span>{m.about_breadcrumb_about()}</span>
		</div>

		<!-- Texte principal -->
		<div class="max-w-3xl lg:max-w-[58%] xl:max-w-none">
			<h1
				class="
					text-3xl leading-[1.05] font-bold tracking-tight
					text-[#063b7c]
					sm:text-4xl
					lg:text-5xl
					xl:text-[3.25rem]
				"
			>
				{m.about_title()}
			</h1>

			<p
				class="
					mt-2 text-lg leading-snug text-primary
					sm:text-xl
					lg:text-2xl
				"
			>
				{m.about_subtitle()}
			</p>

			<div
				class="
					mt-6 max-w-125 space-y-4 text-sm leading-6 text-[#063b7c]
					sm:text-base sm:leading-7
					2xl:max-w-300 3xl:max-w-none
				"
			>
				<p>{m.about_intro_1()}</p>
				<p>{m.about_intro_2()}</p>
			</div>
		</div>

		<!-- Valeurs -->
		<div
			class="
				mt-8 grid max-w-4xl grid-cols-1 gap-6
				sm:grid-cols-3 sm:gap-5
				lg:mt-10 lg:max-w-[75%] lg:gap-8
				xl:max-w-[78%]
			"
		>
			{#each values as value (value.icon)}
				<div class="flex items-start gap-4">
					<span
						class="flex size-15 shrink-0 items-center justify-center rounded-full text-white {value.iconClass}"
					>
						<value.icon size={40} strokeWidth={2.2} />
					</span>

					<div>
						<h2 class="font-bold text-[#063b7c]">
							{value.title()}
						</h2>

						<p class="mt-1 text-sm leading-5 text-[#063b7c]">
							{value.description()}
						</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>
