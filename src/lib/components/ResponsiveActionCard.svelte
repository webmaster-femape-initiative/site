<script lang="ts">
	import { ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

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
		 * Permet éventuellement d'ajouter des classes depuis le parent.
		 */
		class?: string;
	};

	let { title, description, icon, image, imageAlt = '', class: className = '' }: Props = $props();

	let open = $state(false);
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

			<!--
				Animation sans avoir besoin de connaître la hauteur
				du contenu.
			-->
			<div
				class="
					grid transition-[grid-template-rows]
					duration-300 ease-in-out
					{open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
				"
			>
				<div class="overflow-hidden">
					<p
						class="
							px-4 pb-4
							text-sm leading-6
							text-primary
						"
					>
						{description}
					</p>
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
			md:block
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

		<div class="p-5 lg:p-6">
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
					2xl:text-2xl 3xl:text-3xl
				"
				>
					{title}
				</h3>
			</div>

			<p
				class="
				mt-3 text-sm leading-6
					text-primary
					lg:text-base xl:text-lg 2xl:text-xl
				3xl:text-2xl
			"
			>
				{description}
			</p>
		</div>
	</article>
</div>
