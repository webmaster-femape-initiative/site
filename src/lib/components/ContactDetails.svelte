<script lang="ts">
	import { Clock, Mail, MapPin, Phone } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages';

	const contactItems = [
		{
			icon: Mail,
			title: m.contact_details_email_title,
			value: m.contact_details_email_value,
			description: m.contact_details_email_description,
			href: `mailto:${m.contact_details_email_value()}`,
			variant: 'blue'
		},
		{
			icon: Phone,
			title: m.contact_details_phone_title,
			value: m.contact_details_phone_value,
			description: m.contact_details_phone_description,
			href: `tel:${m.contact_details_phone_link()}`,
			variant: 'blue'
		},
		{
			icon: MapPin,
			title: m.contact_details_address_title,
			value: m.contact_details_address_value,
			description: m.contact_details_address_description,
			href: undefined,
			variant: 'red'
		},
		{
			icon: Clock,
			title: m.contact_details_hours_title,
			value: m.contact_details_hours_value,
			description: m.contact_details_hours_description,
			href: undefined,
			variant: 'blue'
		}
	] as const;
</script>

<section
	class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8"
	aria-labelledby="contact-details-title"
>
	<header class="mb-6">
		<h2 id="contact-details-title" class="text-2xl font-bold text-[#055097]">
			{m.contact_details_title()}
		</h2>

		<div class="mt-3 h-1 w-10 rounded-full bg-red-500" aria-hidden="true"></div>
	</header>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-1">
		{#each contactItems as item}
			<div
				class="
					flex gap-4 rounded-xl border border-slate-100
					bg-white p-4
					transition-shadow hover:shadow-sm
				"
			>
				<!-- Icône -->
				<div
					class={[
						'flex size-12 shrink-0 items-center justify-center rounded-full text-white',
						item.variant === 'red' ? 'bg-red-500' : 'bg-blue-500'
					]}
				>
					<item.icon size={24} strokeWidth={2} aria-hidden="true" />
				</div>

				<!-- Informations -->
				<div class="min-w-0">
					<h3 class="font-bold text-[#055097]">
						{item.title()}
					</h3>

					{#if item.href}
						<a
							href={item.href}
							class="
								mt-1 block font-semibold
								break-words text-[#055097]
								transition-colors hover:text-blue-700
								hover:underline
							"
						>
							{item.value()}
						</a>
					{:else}
						<p class="mt-1 font-semibold text-[#055097]">
							{item.value()}
						</p>
					{/if}

					<p class="mt-1 text-sm leading-relaxed text-slate-600">
						{item.description()}
					</p>
				</div>
			</div>
		{/each}
	</div>
</section>
