<script lang="ts">
	import DonationForm from '$lib/components/DonationForm.svelte';
	import DonationHero from '$lib/components/DonationHero.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<DonationHero />

<DonationForm data={data.donationForm} />
