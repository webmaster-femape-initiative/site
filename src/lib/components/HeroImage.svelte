<script lang="ts">
	type Props = {
		image: string;
		imageAlt: string;

		objectPosition?: string;

		/**
		 * Active le gradient CSS.
		 * À désactiver pour les images qui possèdent
		 * déjà leur propre fondu.
		 */
		gradient?: boolean;

		class?: string;
	};

	let {
		image,
		imageAlt,
		objectPosition = 'object-center',
		gradient = true,
		class: className = ''
	}: Props = $props();
</script>

<div
	class="
		relative
		order-2

		hidden
		overflow-hidden

		md:block
		md:h-auto
		md:min-h-125

		lg:min-h-135

		xl:min-h-145

		{className}
	"
>
	<img
		src={image}
		alt={imageAlt}
		class="
			absolute inset-0
			h-full w-full
			object-cover
			{objectPosition}
		"
	/>

	{#if gradient}
		<div
			class="
				pointer-events-none
				absolute inset-0

				bg-linear-to-r
				from-base-100/30
				via-transparent
				to-transparent
			"
			aria-hidden="true"
		></div>
	{/if}
</div>
