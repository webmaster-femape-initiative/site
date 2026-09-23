<script lang="ts">
	import { Heart } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	// Adapte le chemin à ton projet
	import solidarityImage from '$lib/assets/solidarity-cta.png';
</script>

<section class="bg-[#eef8ff]">
	<div
		class="
			mx-auto w-full
			px-4 py-8
			sm:px-6 sm:py-10
			md:px-8
			lg:px-10 lg:py-12
			xl:px-12
			2xl:px-16
		"
	>
		<div
			class="
				grid items-center gap-8
				md:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]
				lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]
				xl:gap-12
			"
		>
			<!-- Contenu -->
			<div>
				<h2
					class="
						text-2xl leading-tight font-bold
						tracking-tight text-[#063b7c]
						sm:text-3xl
						lg:text-4xl
                        xl:text-5xl
                        2xl:text-6xl
                        3xl:text-7xl
					"
				>
					{m.about_solidarity_title()}
				</h2>

				<p
					class="
						mt-1 text-lg font-semibold
						text-[#063b7c]
						sm:text-xl
                        lg:text-2xl
                        xl:text-3xl
                        2xl:text-4xl
                        3xl:text-5xl
					"
				>
					{m.about_solidarity_subtitle()}
				</p>

				<p
					class="
						mt-3
						text-sm leading-6 text-primary
						sm:text-base sm:leading-7
                        lg:text-base
                        xl:text-xl
                        2xl:text-2xl
                        3xl:text-3xl
					"
				>
					{m.about_solidarity_description()}
				</p>

				<a
					href="#"
					class="
						mt-6 inline-flex min-h-11
						items-center justify-center gap-2
						rounded-md bg-[#ef233c]
						px-6 py-2.5
						text-sm font-semibold text-white
						transition-colors
						hover:bg-[#d90429]
						focus-visible:outline-2
						focus-visible:outline-offset-2
						focus-visible:outline-[#ef233c]
                        lg:text-base
                        xl:text-xl
                        2xl:text-2xl
                        3xl:text-3xl
					"
				>
					<Heart size={18} strokeWidth={2.2} aria-hidden="true" />

					{m.about_solidarity_donate()}
				</a>
			</div>

			<!--
				Image masquée sur mobile.
				Elle apparaît à partir de md.
			-->
			<div class="hidden md:block">
				<img
					src={solidarityImage}
					alt={m.about_solidarity_image_alt()}
					class="
						aspect-video w-full
						rounded-lg object-cover
						lg:rounded-xl
					"
				/>
			</div>
		</div>
	</div>
</section>
