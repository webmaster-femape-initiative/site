<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		image: string;
		imageAlt: string;
		children: Snippet;

		imagePosition?: 'left' | 'right';
	};

	let { image, imageAlt, children, imagePosition = 'right' }: Props = $props();
</script>

<div
	class="
		grid grid-cols-2
		items-center
		gap-12
		2xl:gap-16
	"
>
	<div class={imagePosition === 'left' ? 'order-2' : 'order-1'}>
		<div
			class="
				text-base leading-7
				text-[#063b7c]
				2xl:text-xl 2xl:leading-8
			"
		>
			{@render children()}
		</div>
	</div>

	<div
		class="
			{imagePosition === 'left' ? 'order-1' : 'order-2'}
			flex items-center
		"
	>
		<img
			src={image}
			alt={imageAlt}
			class="
    			aspect-4/3
                w-full
				rounded-xl
				object-cover
                2xl:aspect-video
			"
		/>
	</div>
</div>
