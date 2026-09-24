<script lang="ts">
	import { Heart } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	import donationImage from '$lib/assets/donation-heart.png';
</script>

<section
	class="
		px-5 pt-4 pb-10
		sm:px-8 sm:pb-12
		lg:px-12
		xl:px-16 xl:pb-16
	"
	aria-labelledby="programs-donation-title"
>
	<div class="mx-auto">
		<div
			class="
				overflow-hidden
				rounded-xl
				border border-base-200
				bg-white
				shadow-sm

				md:grid
				md:grid-cols-[minmax(220px,32%)_1fr]
				
				lg:grid-cols-[minmax(260px,32%)_1fr]
			"
		>
			<!-- =====================================================
			     IMAGE
			     ===================================================== -->

			<div
				class="
					relative
					aspect-16/8
					overflow-hidden

					md:aspect-auto
					md:min-h-64
				"
			>
				<img
					src={donationImage}
					alt=""
					class="
						absolute inset-0
						h-full w-full
						object-cover
					"
				/>

				<!-- Fondu léger vers le contenu sur écran large -->
				<div
					class="
						pointer-events-none
						absolute inset-0
						hidden
						bg-linear-to-r
						from-transparent
						via-transparent
						to-white/25
						md:block
					"
					aria-hidden="true"
				></div>
			</div>

			<!-- =====================================================
			     CONTENU
			     ===================================================== -->

			<div
				class="
					flex flex-col
					justify-center
					p-5

					sm:p-6

					md:p-8

					lg:flex-row
					lg:items-center
					lg:justify-between
					lg:gap-8
					lg:p-10

					xl:gap-12
					xl:px-12
				"
			>
				<!-- Texte -->
				<div>
					<p
						class="
							text-xs
							font-bold
							tracking-wide
							text-secondary
							uppercase

							sm:text-sm
						"
					>
						{m.programs_donation_eyebrow()}
					</p>

					<h2
						id="programs-donation-title"
						class="
							mt-1
							text-2xl
							leading-tight
							font-bold
							text-primary

							sm:text-3xl
							lg:text-4xl
						"
					>
						{m.programs_donation_title()}
					</h2>

					<p
						class="
							mt-3
							max-w-xl
							text-sm
							leading-6
							text-primary/80

							sm:text-base
							sm:leading-7
						"
					>
						{m.programs_donation_description()}
					</p>
				</div>

				<!-- Action -->
				<div
					class="
						mt-6
						flex
						shrink-0
						flex-col
						items-start

						lg:mt-0
						lg:items-end
					"
				>
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

					<!-- Signature décorative -->
					<div
						class="
							mt-5
							hidden
							rotate-[-4deg]
							lg:block
						"
						aria-hidden="true"
					>
						<p
							class="
								text-lg
								font-semibold
								text-primary
								italic
							"
						>
							{m.programs_donation_signature()}
						</p>

						<div
							class="
								mt-1
								ml-auto
								h-0.5
								w-20
								rotate-[-5deg]
								rounded-full
								bg-secondary
							"
						></div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
