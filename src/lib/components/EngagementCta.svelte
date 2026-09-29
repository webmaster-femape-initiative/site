<script lang="ts">
	import { Heart, HandHeart, ArrowRight } from '@lucide/svelte';
	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	let {
		class: className = ''
	}: {
		class?: string;
	} = $props();
</script>

<section
	class={[
		'bg-primary px-5 pt-12 pb-16 text-white md:px-8 md:pt-16 md:pb-20 xl:pt-20 xl:pb-24',
		className
	]}
	aria-labelledby="engagement-cta-title"
>
	<div class="mx-auto max-w-5xl text-center">
		<!-- Icône -->
		<div
			class="
				mx-auto flex size-14 items-center justify-center
				rounded-full bg-white/10
				md:size-16
			"
		>
			<Heart size={30} strokeWidth={2} aria-hidden="true" />
		</div>

		<!-- Texte -->
		<h2
			id="engagement-cta-title"
			class="mt-6 text-2xl font-bold text-white md:text-3xl xl:text-4xl"
		>
			{m.engagement_cta_title()}
		</h2>

		<p
			class="
				mx-auto mt-4 max-w-2xl
				text-sm leading-relaxed text-white/90
				md:text-base
				xl:text-lg
			"
		>
			{m.engagement_cta_description()}
		</p>

		<!-- Actions -->
		<div
			class="
		mt-8 mb-8 flex flex-col items-stretch justify-center gap-4
		sm:flex-row sm:items-center
		md:mb-10
		xl:mb-12
	"
		>
			<!-- Don -->
			<a
				href={localizeHref('/don')}
				class="
					btn min-h-12 border-0
					bg-secondary px-7 text-white
					shadow-sm
					hover:bg-secondary/90
				"
			>
				<Heart size={19} strokeWidth={2} aria-hidden="true" />

				{m.engagement_cta_donate()}

				<ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
			</a>

			<!-- Engagement -->
			<a
				href={localizeHref('/about#engagement')}
				class="
					btn min-h-12
					border-white bg-transparent px-7
					text-white
					hover:border-white hover:bg-white hover:text-primary
				"
			>
				<HandHeart size={20} strokeWidth={2} aria-hidden="true" />

				{m.engagement_cta_get_involved()}

				<ArrowRight size={18} strokeWidth={2} aria-hidden="true" />
			</a>
		</div>
	</div>
	<!-- Transition CTA / Footer -->
	<!-- Transition CTA / Footer -->
	<div class="relative h-8 bg-white md:h-10" aria-hidden="true">
		<div
			class="
			absolute top-3 left-1/2
			h-1.5 w-32 -translate-x-1/2
			rounded-full bg-secondary
			md:top-4 md:w-48
		"
		></div>
	</div>
</section>
