<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		image,
		icon
	}: {
		title: string;
		description: string;
		image: string;
		icon: Snippet;
	} = $props();
</script>

<article
	class="
    card
    overflow-hidden
    border border-base-300
    bg-base-100
    shadow-sm
    transition
    hover:-translate-y-1
    hover:shadow-md
  "
>
	<figure>
		<img
			src={image}
			alt=""
			class="
    4k:h-64 h-28 w-full
    object-cover
    lg:h-36
    xl:h-80
	2xl:h-110
    3xl:h-140
  "
		/>
	</figure>

	<div class="card-body gap-3 p-4 lg:p-5 xl:p-6">
		<div class="flex items-center gap-3">
			{@render icon()}

			<h3
				class="
    card-title
    text-sm leading-tight font-semibold text-primary
    lg:text-base
    xl:text-xl
    3xl:text-2xl
  "
			>
				{title}
			</h3>
		</div>

		<p
			class="
    text-xs leading-relaxed text-primary/75
    lg:text-sm
    xl:text-base
    3xl:text-lg
  "
		>
			{description}
		</p>
	</div>
</article>
