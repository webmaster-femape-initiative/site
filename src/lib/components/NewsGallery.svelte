<script lang="ts">
	import { ChevronLeft, ChevronRight, Maximize2, X } from '@lucide/svelte';

	import { onMount } from 'svelte';

	import * as m from '$lib/paraglide/messages';

	type GalleryImage = {
		medium: string;
		position: number;
	};

	let {
		images
	}: {
		images: GalleryImage[];
	} = $props();

	let selectedIndex = $state<number | null>(null);

	const selectedImage = $derived(selectedIndex !== null ? images[selectedIndex] : null);

	const open = (index: number) => {
		selectedIndex = index;
	};

	const close = () => {
		selectedIndex = null;
	};

	const previous = () => {
		if (selectedIndex === null || images.length === 0) {
			return;
		}

		selectedIndex = selectedIndex === 0 ? images.length - 1 : selectedIndex - 1;
	};

	const next = () => {
		if (selectedIndex === null || images.length === 0) {
			return;
		}

		selectedIndex = selectedIndex === images.length - 1 ? 0 : selectedIndex + 1;
	};

	onMount(() => {
		const handleKeydown = (event: KeyboardEvent) => {
			if (selectedIndex === null) {
				return;
			}

			switch (event.key) {
				case 'Escape':
					close();
					break;

				case 'ArrowLeft':
					previous();
					break;

				case 'ArrowRight':
					next();
					break;
			}
		};

		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

{#if images.length > 0}
	<!-- =========================================================
         Miniatures
         ========================================================= -->

	<div class="grid grid-cols-2 gap-2 sm:gap-3">
		{#each images as image, index (image.position)}
			<button
				type="button"
				onclick={() => open(index)}
				aria-label={m.newsGallery_enlargeImage({
					number: index + 1
				})}
				class="
        group relative
        aspect-4/3
        cursor-zoom-in
        overflow-hidden
        rounded-lg
        bg-base-200

        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-primary
    "
			>
				<img
					src={`/api/media/${image.medium}`}
					alt=""
					loading="lazy"
					class="
                        size-full
                        object-cover

                        transition-transform
                        duration-300

                        group-hover:scale-105
                    "
				/>

				<!-- Effet au survol -->

				<span
					class="
                        pointer-events-none
                        absolute inset-0

                        flex items-center justify-center

                        bg-black/0
                        transition-colors
                        duration-300

                        group-hover:bg-black/20
                    "
				>
					<Maximize2
						size={24}
						strokeWidth={1.8}
						class="
                            scale-75
                            text-white
                            opacity-0

                            transition-all
                            duration-200

                            group-hover:scale-100
                            group-hover:opacity-100
                        "
					/>
				</span>
			</button>
		{/each}
	</div>

	<!-- =========================================================
         Lightbox
         ========================================================= -->

	{#if selectedImage}
		<div
			class="
        fixed inset-0 z-50
        flex items-center justify-center
        p-4
        sm:p-8
        lg:p-12
    "
			role="dialog"
			aria-modal="true"
			aria-label={m.newsGallery_dialogLabel()}
			tabindex="-1"
		>
			<!-- =================================================
                 Arrière-plan cliquable

                 C'est un vrai bouton : pas de warning a11y lié
                 à un onclick placé sur un div.
                 ================================================= -->

			<button
				type="button"
				onclick={close}
				aria-label={m.newsGallery_close()}
				class="
        absolute inset-0
        cursor-default
        bg-black/85
        backdrop-blur-sm
    "
			></button>

			<!-- =================================================
                 Image
                 ================================================= -->

			<div
				class="
                    relative z-10

                    flex max-h-full max-w-full
                    items-center justify-center
                "
			>
				<img
					src={`/api/media/${selectedImage.medium}`}
					alt=""
					class="
                        max-h-[85vh]
                        max-w-[90vw]

                        rounded-lg
                        object-contain

                        shadow-2xl
                    "
				/>

				<!-- =============================================
                     Fermeture
                     ============================================= -->

				<button
					type="button"
					onclick={close}
					aria-label={m.newsGallery_close()}
					class="
        absolute -top-12 right-0
        flex size-10
        cursor-pointer
        items-center justify-center
        rounded-full
        bg-white/10
        text-white
        transition-colors
        hover:bg-white/20
        focus-visible:outline-2
        focus-visible:outline-white
    "
				>
					<X size={24} strokeWidth={2} />
				</button>

				<!-- =============================================
                     Navigation
                     ============================================= -->

				{#if images.length > 1}
					<!-- Précédente -->

					<button
						type="button"
						onclick={previous}
						aria-label={m.newsGallery_previous()}
						class="
                            absolute
                            top-1/2
                            -left-3
                            flex
                            size-11

                            -translate-x-full -translate-y-1/2
                            cursor-pointer
                            items-center justify-center

                            rounded-full
                            bg-white/10
                            text-white

                            transition-colors
                            hover:bg-white/20

                            focus-visible:outline-2
                            focus-visible:outline-white

                            sm:-left-5
                        "
					>
						<ChevronLeft size={26} strokeWidth={2} />
					</button>

					<!-- Suivante -->

					<button
						type="button"
						onclick={next}
						aria-label={m.newsGallery_next()}
						class="
                            absolute
                            top-1/2
                            -right-3
                            flex
                            size-11

                            translate-x-full -translate-y-1/2
                            cursor-pointer
                            items-center justify-center

                            rounded-full
                            bg-white/10
                            text-white

                            transition-colors
                            hover:bg-white/20

                            focus-visible:outline-2
                            focus-visible:outline-white

                            sm:-right-5
                        "
					>
						<ChevronRight size={26} strokeWidth={2} />
					</button>
				{/if}
			</div>

			<!-- =================================================
                 Compteur
                 ================================================= -->

			{#if images.length > 1}
				<div
					class="
                        pointer-events-none
                        absolute
                        bottom-4 left-1/2 z-10
                        -translate-x-1/2

                        rounded-full
                        bg-black/30
                        px-3 py-1.5

                        text-sm font-medium
                        text-white/90

                        sm:bottom-6
                    "
				>
					{(selectedIndex ?? 0) + 1} / {images.length}
				</div>
			{/if}
		</div>
	{/if}
{/if}
