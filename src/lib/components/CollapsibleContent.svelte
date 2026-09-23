<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		summary: string;
		expandLabel: string;
		collapseLabel: string;
		children: Snippet;
	};

	let { summary, expandLabel, collapseLabel, children }: Props = $props();

	let expanded = $state(false);
</script>

<div>
	<p class="text-sm leading-6 text-[#063b7c]">
		{summary}
	</p>

	<div
		class="
			grid transition-[grid-template-rows]
			duration-300 ease-in-out
			{expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}
		"
	>
		<div class="overflow-hidden">
			<div class="pt-4">
				{@render children()}
			</div>
		</div>
	</div>

	<button
		type="button"
		aria-expanded={expanded}
		onclick={() => (expanded = !expanded)}
		class="
			mt-4 inline-flex items-center gap-2
			text-sm font-semibold text-primary
			transition-colors hover:text-[#063b7c]
		"
	>
		{expanded ? collapseLabel : expandLabel}

		<ChevronDown
			size={18}
			strokeWidth={2}
			class="
				transition-transform duration-300
				{expanded ? 'rotate-180' : ''}
			"
			aria-hidden="true"
		/>
	</button>
</div>
