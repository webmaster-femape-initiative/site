<script lang="ts">
	import type { Snippet } from 'svelte';

	import MobileImageContent from '$lib/components/MobileImageContent.svelte';
	import FloatingImageContent from '$lib/components/FloatingImageContent.svelte';

	type ImagePosition = 'left' | 'right';
	type ImageSize = 'sm' | 'md' | 'lg';
	type Variant = 'primary' | 'secondary' | 'sky' | 'amber';

	type Props = {
		id: string;
		title: string;

		description?: string;
		children?: Snippet;

		image: string;
		imageAlt: string;

		imagePosition?: ImagePosition;
		imageSize?: ImageSize;

		variant?: Variant;
	};

	let {
		id,
		title,
		description,
		children,
		image,
		imageAlt,
		imagePosition = 'right',
		imageSize = 'md',
		variant = 'primary'
	}: Props = $props();

	const backgrounds: Record<Variant, string> = {
		primary: 'bg-primary/5',
		secondary: 'bg-secondary/5',
		sky: 'bg-sky-50',
		amber: 'bg-amber-50'
	};
</script>

{#snippet heading()}
	<div class="flex items-center gap-4">
		<div class="min-w-0">
			<h3
				id="{id}-title"
				class="
					text-xl
					leading-tight
					font-bold
					text-primary

					md:text-2xl
					xl:text-3xl
				"
			>
				{title}
			</h3>
		</div>
	</div>
{/snippet}

{#snippet content()}
	{#if children}
		<div class="space-y-4">
			{@render children()}
		</div>
	{:else if description}
		<p>{description}</p>
	{/if}
{/snippet}

<section {id} class="scroll-mt-24 rounded-xl {backgrounds[variant]}" aria-labelledby="{id}-title">
	<!-- Mobile -->

	<div class="md:hidden">
		<MobileImageContent {image} {imageAlt} class={backgrounds[variant]}>
			{@render heading()}

			<div
				class="
					mt-4
					text-sm
					leading-6
					text-primary/80
				"
			>
				{@render content()}
			</div>
		</MobileImageContent>
	</div>

	<!-- Tablette / desktop -->

	<div
		class="
			hidden
			p-6

			md:block

			lg:p-8

			xl:p-10

			2xl:p-12
		"
	>
		{@render heading()}

		<div class="mt-5">
			<FloatingImageContent {image} {imageAlt} position={imagePosition} size={imageSize}>
				{@render content()}
			</FloatingImageContent>
		</div>
	</div>
</section>
