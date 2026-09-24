<script lang="ts">
	import { ChevronRight, ArrowRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { localizeHref } from '$lib/paraglide/runtime.js';

	type Props = {
		title: string;
		description: string;

		/**
		 * Icône passée par le parent.
		 */
		icon: Snippet;

		/**
		 * Image facultative.
		 * Si elle n'est pas renseignée, la card commence directement
		 * par son contenu.
		 */
		image?: string;
		imageAlt?: string;

		/**
		 * CTA facultatif.
		 * Il est affiché uniquement si ctaLabel et ctaHref
		 * sont tous les deux renseignés.
		 */
		ctaLabel?: string;
		ctaHref?: string;

		/**
		 * Classes facultatives appliquées au CTA.
		 * Permet notamment d'utiliser la couleur correspondant
		 * à l'action : primary, secondary, sky...
		 */
		ctaClass?: string;

		/**
		 * Permet éventuellement d'ajouter des classes
		 * depuis le parent.
		 */
		class?: string;
	};

	let {
		title,
		description,
		icon,
		image,
		imageAlt = '',
		ctaLabel,
		ctaHref,
		ctaClass = 'text-primary',
		class: className = ''
	}: Props = $props();

	let open = $state(false);

	const hasCta = $derived(Boolean(ctaLabel && ctaHref));
</script>

<div class={className}>
	<!-- =========================================================
	     MOBILE : COLLAPSIBLE
	     ========================================================= -->

	<div class="md:hidden">
		<div class="overflow-hidden rounded-lg border border-base-200 bg-white">
			<button
				type="button"
				class="
					flex w-full items-center gap-4
					p-4 text-left
				"
				aria-expanded={open}
				onclick={() => (open = !open)}
			>
				<!-- Icône -->
				<div class="shrink-0">
					{@render icon()}
				</div>

				<!-- Titre -->
				<h3
					class="
						min-w-0 flex-1
						text-sm leading-tight font-bold
						text-primary
					"
				>
					{title}
				</h3>

				<!-- Chevron -->
				<ChevronRight
					size={20}
					strokeWidth={2.2}
					class="
						shrink-0 text-[#0878e8]
						transition-transform duration-300
						{open ? 'rotate-90' : ''}
					"
					aria-hidden="true"
				/>
			</button>

			<!-- Contenu dépliable -->
			<div
				class="
					grid transition-[grid-template-rows]
					duration-300 ease-in-out
					{open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
				"
			>
				<div class="overflow-hidden">
					<div class="px-4 pb-4">
						<p
							class="
								text-sm leading-6
								text-primary
							"
						>
							{description}
						</p>

						{#if hasCta}
							<a
								href={ctaHref}
								class="
									mt-3 inline-flex
									items-center gap-1.5
									text-sm font-semibold
									transition-[gap]
									duration-200
									hover:gap-2.5
									{ctaClass}
								"
							>
								<span>{ctaLabel}</span>

								<ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
							</a>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- =========================================================
	     TABLETTE + DESKTOP : CARD
	     ========================================================= -->

	<article
		class="
			hidden h-full overflow-hidden
			rounded-lg border border-base-200 bg-white
			md:flex md:flex-col
		"
	>
		<!-- Image facultative -->
		{#if image}
			<img
				src={image}
				alt={imageAlt}
				class="
					aspect-video w-full
					object-cover
				"
			/>
		{/if}

		<!--
			flex-1 permet au contenu de prendre toute la hauteur
			disponible afin d'aligner les CTA entre les cards.
		-->
		<div class="flex flex-1 flex-col p-5 lg:p-6">
			<!--
				md / lg : icône au-dessus du titre
				xl+     : icône et titre alignés
			-->
			<div
				class="
					flex flex-col items-start gap-3
					xl:flex-row xl:items-center xl:gap-4
				"
			>
				<div class="shrink-0">
					{@render icon()}
				</div>

				<h3
					class="
						text-base leading-tight
						font-bold
						text-primary
						lg:text-lg
						xl:text-xl
						2xl:text-2xl
						3xl:text-3xl
					"
				>
					{title}
				</h3>
			</div>

			<p
				class="
					mt-3
					text-sm leading-6
					text-primary
					lg:text-base
					xl:text-lg
					2xl:text-xl
					3xl:text-2xl
				"
			>
				{description}
			</p>

			{#if hasCta}
				<a
					href={ctaHref?.startsWith('#') ? ctaHref : localizeHref(ctaHref)}
					class="
						mt-auto
						inline-flex w-fit
						items-center gap-2
						pt-5
						text-sm font-semibold
						transition-[gap]
						duration-200
						hover:gap-3
						lg:text-base
						{ctaClass}
					"
				>
					<span>{ctaLabel}</span>

					<ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
				</a>
			{/if}
		</div>
	</article>
</div>
