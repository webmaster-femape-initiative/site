<script lang="ts">
	import reintegrationImage from '$lib/assets/reinsertion.png';
	import * as m from '$lib/paraglide/messages';
	import ProgrammeDetail from './ProgrammeDetail.svelte';
</script>

<section
	class="
		bg-base-100
		px-5 py-4
		sm:px-8
		lg:px-12
		xl:px-16
	"
>
	<div class="mx-auto">
		<ProgrammeDetail
			id="reinsertion-sociale-professionnelle"
			title={m.programs_reintegration_title()}
			description={m.programs_reintegration_description()}
			image={reintegrationImage}
			imageAlt={m.programs_reintegration_detail_image_alt()}
			imagePosition="right"
			imageSize="md"
			variant="secondary"
		/>
	</div>
</section>
