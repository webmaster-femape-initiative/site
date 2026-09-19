<script lang="ts">
	// Remplace par le chemin de l'image générée dans ton projet.
	import africaImg from '$lib/assets/africa.png';
	import { Info } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
</script>

<section class="bg-primary/5">
	<div
		class="
      mx-auto grid
      w-full



      [grid-template-areas:'title'_'image'_'content']
      md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]

      md:[grid-template-areas:'title_title'_'image_content']
      lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]

      lg:[grid-template-areas:'image_title'_'image_content']

    "
	>
		<!-- =====================================================
         TITRE
         ===================================================== -->

		<header
			class="
        4k:px-20

        4k:pt-16
        px-4
        pt-7

        pb-5
        [grid-area:title]
        md:px-6

        md:pt-8
        md:pb-5
        lg:self-end
        lg:px-10

        lg:pt-10

        lg:pb-3
        xl:px-12
        3xl:px-16

        3xl:pt-14
        3xl:pb-4
      "
		>
			<h2
				class="
          4k:text-5xl
          text-2xl
          leading-tight
          font-semibold

          text-primary

          md:text-3xl xl:text-4xl 2xl:text-5xl 3xl:text-6xl
        "
			>
				{m.africa_actions_title()}
			</h2>

			<!-- Trait rouge -->
			<div
				class="
          4k:h-1
          4k:w-14
          mt-3
          h-0.75
          w-10

          rounded-full

          bg-secondary
          3xl:w-12
        "
			></div>
		</header>

		<!-- =====================================================
         IMAGE
         ===================================================== -->

		<figure
			class="
        4k:min-h-[28rem]

        h-56
        min-w-0
        overflow-hidden

        [grid-area:image]
        md:h-full

        md:min-h-64

        lg:min-h-80

        3xl:min-h-96
      "
		>
			<img
				src={africaImg}
				alt="Actions de FEMAPE Initiative auprès des populations en Afrique"
				class="
          h-full
          w-full
          object-cover
          object-center
        "
			/>
		</figure>

		<!-- =====================================================
         CONTENU
         ===================================================== -->

		<div
			class="
        4k:px-20

        4k:pb-16
        flex
        min-w-0
        flex-col

        justify-start
        px-4

        py-6
        [grid-area:content]

        md:px-6
        md:py-7
        lg:px-10

        lg:pt-3

        lg:pb-10
        xl:px-12
        3xl:px-16

        3xl:pt-4
        3xl:pb-14
      "
		>
			<!-- Présentation -->
			<p
				class="
          
          text-sm
          leading-relaxed

          text-primary/80

          lg:text-base

          xl:text-xl 2xl:text-2xl 3xl:text-3xl
        "
			>
				{m.africa_actions_description()}
			</p>

			<!-- ===================================================
           INFORMATION
           DaisyUI Alert
           =================================================== -->

			<div
				role="alert"
				class="
          4k:p-6

          mt-5

          alert
          grid
          grid-cols-[auto_minmax(0,1fr)]
          items-center

          gap-4
          border-0
          bg-primary/5
          text-primary

          shadow-none

          md:p-4
          3xl:mt-7
          3xl:gap-5

          3xl:p-5
        "
			>
				<!-- Cercle de l'icône -->
				<div
					class="
            4k:size-12
            flex
            size-9
            shrink-0
            items-center
            justify-center
            rounded-full
            bg-primary

            text-white

            3xl:size-11
          "
				>
					<Info
						class="
              4k:size-7

              size-5

              3xl:size-6
            "
						strokeWidth={2.2}
					/>
				</div>

				<p
					class="
            

            min-w-0
            text-sm
            leading-relaxed

            text-primary/80

            md:text-base

            xl:text-lg 2xl:text-xl 3xl:text-2xl
          "
				>
					{m.africa_actions_info()}
				</p>
			</div>
		</div>
	</div>
</section>
