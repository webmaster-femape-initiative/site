<script lang="ts">
	import Hero from '$lib/components/Hero.svelte';
	import NewsPanel from '$lib/components/NewsPanel.svelte';

	let { data } = $props();
</script>

<Hero />

<NewsPanel
	newsList={data.newsList}
	categories={data.categories}
	filters={data.filters}
	pagination={data.pagination}
/>
