<script lang="ts">
	import ActionCollapse from '$lib/components/ActionCollapse.svelte';
	import ActionCard from '$lib/components/ActionCard.svelte';

	import assistanceImg from '$lib/assets/assistance.png';
	import reinsertionImg from '$lib/assets/reinsertion.png';
	import sansAbriImg from '$lib/assets/aide-sans-abris.png';
	import * as m from '$lib/paraglide/messages.js';
	import { House, Sprout, Users } from '@lucide/svelte';

	const actions = [
		{
			title: m.actions_assistance_title(),
			description: m.actions_assistance_description(),
			image: assistanceImg,
			icon: Users,
			iconClass: 'bg-primary'
		},
		{
			title: m.actions_reintegration_title(),
			description: m.actions_reintegration_description(),
			image: reinsertionImg,
			icon: Sprout,
			iconClass: 'bg-secondary'
		},
		{
			title: m.actions_homeless_title(),
			description: m.actions_homeless_description(),
			image: sansAbriImg,
			icon: House,
			iconClass: 'bg-sky-400'
		}
	];
</script>

<section class="bg-base-100 px-4 py-10 md:px-6 lg:px-8">
	<div class="mx-auto">
		<!-- Titre -->
		<header class="mb-7 text-center md:mb-9">
			<h2
				class="text-2xl font-semibold text-primary md:text-3xl xl:text-4xl 2xl:text-5xl 3xl:text-6xl"
			>
				{m.actions_title()}
			</h2>

			<p class="mt-1 text-sm text-primary/70 md:text-base xl:text-xl 2xl:text-2xl 3xl:text-3xl">
				{m.actions_subtitle()}
			</p>

			<div class="mx-auto mt-3 h-0.75 w-10 rounded-full bg-secondary"></div>

			<p
				class="
          mx-auto mt-5 hidden
          leading-relaxed text-primary/80
          xl:block xl:text-xl 2xl:text-2xl 3xl:text-3xl
        "
			>
				{m.actions_intro()}
			</p>
		</header>

		<!-- =====================================================
         MOBILE : COLLAPSE DAISYUI
         ===================================================== -->

		<div class="flex flex-col gap-3 md:hidden">
			{#each actions as action (action.title)}
				{@const Icon = action.icon}

				{#snippet actionIcon()}
					<span
						class="flex size-11 shrink-0 items-center justify-center rounded-full text-white {action.iconClass}"
					>
						<Icon size={22} strokeWidth={2.2} />
					</span>
				{/snippet}
				<ActionCollapse title={action.title} description={action.description} icon={actionIcon} />
			{/each}
		</div>

		<!-- =====================================================
         TABLETTE / DESKTOP : CARDS DAISYUI
         ===================================================== -->

		<div class="hidden grid-cols-3 gap-4 md:grid lg:gap-6">
			{#each actions as action (action.title)}
				{@const Icon = action.icon}

				{#snippet actionIcon()}
					<span
						class="flex size-11 shrink-0 items-center justify-center rounded-full text-white {action.iconClass} 2xl:size-14 3xl:size-16"
					>
						<Icon class="size-5.5 2xl:size-7 3xl:size-10" strokeWidth={2.2} />
					</span>
				{/snippet}

				<ActionCard
					title={action.title}
					description={action.description}
					image={action.image}
					icon={actionIcon}
				/>
			{/each}
		</div>
	</div>
</section>
