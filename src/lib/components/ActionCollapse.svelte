<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		icon
	}: {
		title: string;
		description: string;
		icon: Snippet;
	} = $props();
</script>

<div
	class="
    collapse-arrow collapse
    border border-base-300
    bg-base-100
    shadow-sm
  "
>
	<input type="checkbox" />

	<div class="collapse-title flex items-center gap-3">
		{@render icon()}

		<h3 class="text-sm font-semibold text-primary">
			{title}
		</h3>
	</div>

	<div class="collapse-content">
		<p class="px-1 pb-2 text-sm leading-relaxed text-primary/75">
			{description}
		</p>
	</div>
</div>
