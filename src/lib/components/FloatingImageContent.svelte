<script lang="ts">
	import type { Snippet } from 'svelte';

	type ImagePosition = 'left' | 'right';
	type ImageSize = 'sm' | 'md' | 'lg';

	type Props = {
		image: string;
		imageAlt: string;
		children: Snippet;

		position?: ImagePosition;
		size?: ImageSize;

		class?: string;
	};

	let {
		image,
		imageAlt,
		children,
		position = 'right',
		size = 'md',
		class: className = ''
	}: Props = $props();

	const positionClasses: Record<ImagePosition, string> = {
		left: `
			float-left
			mr-6 mb-4
			lg:mr-8 lg:mb-5
		`,

		right: `
			float-right
			ml-6 mb-4
			lg:ml-8 lg:mb-5
		`
	};

	const sizeClasses: Record<ImageSize, string> = {
		sm: `
			w-[32%]
			max-w-80
			lg:w-[34%]
			lg:max-w-90
		`,

		md: `
			w-[40%]
			max-w-96
			lg:w-[42%]
			lg:max-w-105
		`,

		lg: `
			w-[46%]
			max-w-110
			lg:w-[48%]
			lg:max-w-120
		`
	};
</script>

<div class="flow-root {className}">
	<img
		src={image}
		alt={imageAlt}
		class="
			{positionClasses[position]}
			{sizeClasses[size]}

			aspect-4/3
			rounded-xl
			object-cover
		"
	/>

	<div
		class="
			text-sm leading-6 text-primary
			lg:text-base lg:leading-7
			xl:text-lg xl:leading-8
			2xl:text-xl 2xl:leading-9
		"
	>
		{@render children()}
	</div>
</div>
