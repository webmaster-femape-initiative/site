<script lang="ts">
	import Actions from '$lib/components/Actions.svelte';
	import AfricaActions from '$lib/components/AfricaActions.svelte';
	import EngagementCta from '$lib/components/EngagementCta.svelte';
	import Hero from '$lib/components/Hero.svelte';
	import LatestNews from '$lib/components/LatestNews.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Hero />
<Actions />
<AfricaActions />
<LatestNews newsList={data.newsList} />
<EngagementCta />
