<script lang="ts">
	import vulnerablePeopleImage from '$lib/assets/vulnerable-people.png';
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
			id="assistance-personnes-vulnerables"
			title={m.programs_vulnerable_title()}
			description={m.programs_vulnerable_description()}
			image={vulnerablePeopleImage}
			imageAlt={m.programs_vulnerable_detail_image_alt()}
			imagePosition="left"
			imageSize="md"
			variant="primary"
		/>
	</div>
</section>
