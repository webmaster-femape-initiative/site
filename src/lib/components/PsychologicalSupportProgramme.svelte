<script lang="ts">
	import psychologicalSupportImage from '$lib/assets/psychological.png';
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
			id="soutien-psychologique"
			title={m.programs_psychological_title()}
			description={m.programs_psychological_description()}
			image={psychologicalSupportImage}
			imageAlt={m.programs_psychological_detail_image_alt()}
			imagePosition="left"
			imageSize="md"
			variant="sky"
		/>
	</div>
</section>
