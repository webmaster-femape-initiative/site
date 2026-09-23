<script lang="ts">
	import { Search, UsersRound, Target } from '@lucide/svelte';

	import * as m from '$lib/paraglide/messages';

	import ResponsiveActionCard from '$lib/components/ResponsiveActionCard.svelte';

	const approaches = [
		{
			title: m.about_approach_understand_title,
			description: m.about_approach_understand_description,
			icon: Search,
			iconClass: 'bg-primary'
		},
		{
			title: m.about_approach_together_title,
			description: m.about_approach_together_description,
			icon: UsersRound,
			iconClass: 'bg-secondary'
		},
		{
			title: m.about_approach_autonomy_title,
			description: m.about_approach_autonomy_description,
			icon: Target,
			iconClass: 'bg-sky-400'
		}
	];
</script>

<section class="bg-white">
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
		<header class="mb-6 lg:mb-8">
			<p
				class="
					text-xs font-bold tracking-[0.18em]
					text-primary uppercase
				"
			>
				{m.about_approach_eyebrow()}
			</p>

			<div class="mt-3 h-0.75 w-10 rounded-full bg-[#ef233c]"></div>

			<h2
				class="
					mt-4 text-2xl leading-tight
					font-bold tracking-tight
					text-[#063b7c]
					sm:text-3xl
					lg:text-4xl
				"
			>
				{m.about_approach_title()}
			</h2>
		</header>

		<div
			class="
				grid grid-cols-1 gap-3
				md:grid-cols-3 md:gap-5
				lg:gap-8
			"
		>
			{#each approaches as approach (approach.icon)}
				{@const Icon = approach.icon}
				<ResponsiveActionCard title={approach.title()} description={approach.description()}>
					{#snippet icon()}
						<span
							class="flex size-15 shrink-0 items-center justify-center rounded-full text-white {approach.iconClass}"
						>
							<Icon size={40} strokeWidth={2.2} />
						</span>
					{/snippet}
				</ResponsiveActionCard>
			{/each}
		</div>
	</div>
</section>
