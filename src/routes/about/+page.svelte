<script lang="ts">
	import About from '$lib/components/About.svelte';
	import Approaches from '$lib/components/Approaches.svelte';
	import Engage from '$lib/components/Engage.svelte';
	import EngagementPanel from '$lib/components/EngagementPanel.svelte';
	import History from '$lib/components/History.svelte';

	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<About />
<History />
<Approaches />
<Engage />
<EngagementPanel data={data.engagementForm} />
