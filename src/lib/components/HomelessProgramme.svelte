<script lang="ts">
	import ProgrammeDetail from '$lib/components/ProgrammeDetail.svelte';

	import homelessImage from '$lib/assets/aide-sans-abris.png';

	import * as m from '$lib/paraglide/messages';
</script>

<section class="bg-base-100 px-5 py-4 sm:px-8 lg:px-12 xl:px-16">
	<div class="mx-auto">
		<ProgrammeDetail
			id="aide-personnes-sans-abri"
			title={m.programs_homeless_title()}
			image={homelessImage}
			imageAlt={m.programs_homeless_detail_image_alt()}
			imagePosition="right"
			imageSize="md"
			variant="amber"
		>
			<p>
				{m.programs_homeless_description_1()}
			</p>

			<p>
				{m.programs_homeless_description_2()}
			</p>

			<p>
				{m.programs_homeless_description_3()}
			</p>

			<p>
				{m.programs_homeless_description_4()}
			</p>

			<p class="font-semibold text-primary">
				{m.programs_homeless_thanks()}
			</p>
		</ProgrammeDetail>
	</div>
</section>
