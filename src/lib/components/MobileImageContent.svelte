<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		image: string;
		imageAlt: string;
		children: Snippet;
		class?: string;
	};

	let { image, imageAlt, children, class: className = '' }: Props = $props();
</script>

<div
	class="
		overflow-hidden
		rounded-xl
		border border-base-200
		bg-white
		{className}
	"
>
	<img
		src={image}
		alt={imageAlt}
		class="
			aspect-video
			w-full
			object-cover
		"
	/>

	<div class="p-5 sm:p-6">
		{@render children()}
	</div>
</div>
