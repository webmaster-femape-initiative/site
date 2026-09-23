<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		image: string;
		imageAlt: string;
		children: Snippet;
	};

	let { image, imageAlt, children }: Props = $props();
</script>

<div class="flow-root">
	<img
		src={image}
		alt={imageAlt}
		class="
			float-right
			mb-4 ml-6
			aspect-4/3
			w-[42%]
			max-w-105
			rounded-xl
			object-cover

			lg:mb-5
			lg:ml-8
			lg:w-[44%]
		"
	/>

	<div
		class="
			text-sm leading-6 text-[#063b7c]
			lg:text-base lg:leading-7
		"
	>
		{@render children()}
	</div>
</div>
