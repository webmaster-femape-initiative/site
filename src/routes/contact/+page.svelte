<script lang="ts">
	import ContactDetails from '$lib/components/ContactDetails.svelte';

	import ContactForm from '$lib/components/ContactForm.svelte';
	import ContactLocation from '$lib/components/ContactLocation.svelte';
	import EngagementCta from '$lib/components/EngagementCta.svelte';
	import HeroContact from '$lib/components/HeroContact.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<HeroContact />
<section class="bg-slate-50 py-10 md:py-14 lg:py-16">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div
			class="
				grid grid-cols-1 gap-8
				lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]
				xl:grid-cols-[minmax(0,5fr)_minmax(320px,2fr)]
				xl:gap-10
			"
		>
			<ContactForm data={data.form} />
			<ContactDetails />
			<div class="lg:col-span-2">
				<ContactLocation />
			</div>
		</div>
	</div>
</section>
<EngagementCta />
