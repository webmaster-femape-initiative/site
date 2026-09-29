<script lang="ts">
	import * as Form from 'formsnap';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';

	import type { SuperValidated } from 'sveltekit-superforms';
	import type { ContactSchema } from '$lib/schemas/contact';

	import { contactSchema } from '$lib/schemas/contact';
	import * as m from '$lib/paraglide/messages';

	let {
		data
	}: {
		data: SuperValidated<ContactSchema>;
	} = $props();

	const form = superForm(data, {
		validators: zod4Client(contactSchema),

		onUpdated({ form: updatedForm }) {
			if (updatedForm.valid && updatedForm.message === 'success') {
				reset();

				// Un nouvel envoi doit disposer de son propre point de départ
				$formData.formStartedAt = Date.now();
			}
		}
	});

	const { form: formData, enhance, reset, submitting } = form;

	/*
	 * Point de départ utilisé par la protection anti-spam.
	 * Le serveur calculera le temps écoulé entre l'affichage du
	 * formulaire et sa soumission.
	 */
	if (!$formData.formStartedAt) {
		$formData.formStartedAt = Date.now();
	}

	const subjects = [
		{
			value: 'information',
			label: m.contact_form_subject_information()
		},
		{
			value: 'volunteering',
			label: m.contact_form_subject_volunteering()
		},
		{
			value: 'donation',
			label: m.contact_form_subject_donation()
		},
		{
			value: 'partnership',
			label: m.contact_form_subject_partnership()
		},
		{
			value: 'press',
			label: m.contact_form_subject_press()
		},
		{
			value: 'other',
			label: m.contact_form_subject_other()
		}
	] as const;

	function getErrorMessage(error: string): string {
		const messages: Record<string, () => string> = {
			last_name_too_short: m.contact_form_error_last_name_too_short,
			first_name_too_short: m.contact_form_error_first_name_too_short,
			invalid_email: m.contact_form_error_invalid_email,
			invalid_subject: m.contact_form_error_invalid_subject,
			message_too_short: m.contact_form_error_message_too_short
		};

		return messages[error]?.() ?? m.contact_form_error_generic();
	}
</script>

<section class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8 lg:p-10">
	<!-- En-tête du panneau -->
	<header class="mb-8">
		<h2 class="text-2xl font-bold text-primary md:text-3xl">
			{m.contact_form_title()}
		</h2>

		<div class="mt-3 h-1 w-10 rounded-full bg-red-500" aria-hidden="true"></div>

		<p class="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
			{m.contact_form_description()}
		</p>
	</header>

	<form method="POST" use:enhance class="space-y-6">
		<!--
					Honeypot anti-spam.

					Il ne faut pas utiliser type="hidden" : le but est que
					le champ ressemble à un véritable champ pour les bots
					tout en restant inaccessible visuellement.
				-->
		<div class="absolute top-auto left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
			<label for="website"> Website </label>

			<input
				id="website"
				name="website"
				type="text"
				tabindex="-1"
				autocomplete="off"
				bind:value={$formData.website}
			/>
		</div>

		<!-- Timestamp anti-spam -->
		<input type="hidden" name="formStartedAt" value={$formData.formStartedAt} />

		<Form.Field {form} name="lastName">
			<Form.Control>
				{#snippet children({ props })}
					<label for="lastName" class="mb-2 block text-sm font-semibold text-primary">
						{m.contact_form_last_name()}
						<span class="text-red-500" aria-hidden="true">*</span>
					</label>

					<input
						{...props}
						id="lastName"
						type="text"
						autocomplete="family-name"
						bind:value={$formData.lastName}
						class="input-bordered input w-full bg-white
										text-slate-800
										focus:border-primary
										focus:outline-none"
					/>
				{/snippet}
			</Form.Control>

			<Form.FieldErrors>
				{#snippet children({ errors })}
					{#each errors as error (error)}
						<p class="mt-1 text-sm text-red-600">
							{getErrorMessage(error)}
						</p>
					{/each}
				{/snippet}
			</Form.FieldErrors>
		</Form.Field>

		<Form.Field {form} name="firstName">
			<Form.Control>
				{#snippet children({ props })}
					<label for="firstName" class="mb-2 block text-sm font-semibold text-primary">
						{m.contact_form_first_name()}
						<span class="text-red-500" aria-hidden="true">*</span>
					</label>

					<input
						{...props}
						id="firstName"
						type="text"
						autocomplete="given-name"
						bind:value={$formData.firstName}
						class="input-bordered input w-full bg-white
										text-slate-800
										focus:border-primary
										focus:outline-none"
					/>
				{/snippet}
			</Form.Control>

			<Form.FieldErrors>
				{#snippet children({ errors })}
					{#each errors as error (error)}
						<p class="mt-1 text-sm text-red-600">
							{getErrorMessage(error)}
						</p>
					{/each}
				{/snippet}
			</Form.FieldErrors>
		</Form.Field>

		<!-- Email -->
		<Form.Field {form} name="email">
			<Form.Control>
				{#snippet children({ props })}
					<label for="email" class="mb-2 block text-sm font-semibold text-primary">
						{m.contact_form_email()}
						<span class="text-red-500" aria-hidden="true">*</span>
					</label>

					<input
						{...props}
						id="email"
						type="email"
						autocomplete="email"
						bind:value={$formData.email}
						class="input-bordered input w-full bg-white
									text-slate-800
									focus:border-primary
									focus:outline-none"
					/>
				{/snippet}
			</Form.Control>

			<Form.FieldErrors>
				{#snippet children({ errors })}
					{#each errors as error (error)}
						<p class="mt-1 text-sm text-red-600">
							{getErrorMessage(error)}
						</p>
					{/each}
				{/snippet}
			</Form.FieldErrors>
		</Form.Field>

		<!-- Objet -->
		<Form.Field {form} name="subject">
			<Form.Control>
				{#snippet children({ props })}
					<label for="subject" class="mb-2 block text-sm font-semibold text-primary">
						{m.contact_form_subject()}
						<span class="text-red-500" aria-hidden="true">*</span>
					</label>

					<select
						{...props}
						id="subject"
						bind:value={$formData.subject}
						class="select-bordered select w-full bg-white
									text-slate-800
									focus:border-primary
									focus:outline-none"
					>
						<option value="" disabled>
							{m.contact_form_subject_placeholder()}
						</option>

						{#each subjects as subject (subject.value)}
							<option value={subject.value}>
								{subject.label}
							</option>
						{/each}
					</select>
				{/snippet}
			</Form.Control>

			<Form.FieldErrors>
				{#snippet children({ errors })}
					{#each errors as error (error)}
						<p class="mt-1 text-sm text-red-600">
							{getErrorMessage(error)}
						</p>
					{/each}
				{/snippet}
			</Form.FieldErrors>
		</Form.Field>

		<!-- Message -->
		<Form.Field {form} name="message">
			<Form.Control>
				{#snippet children({ props })}
					<label for="message" class="mb-2 block text-sm font-semibold text-primary">
						{m.contact_form_message()}
						<span class="text-red-500" aria-hidden="true">*</span>
					</label>

					<textarea
						{...props}
						id="message"
						rows="7"
						bind:value={$formData.message}
						placeholder={m.contact_form_message_placeholder()}
						class="textarea-bordered textarea w-full resize-y bg-white
									text-slate-800
									focus:border-primary
									focus:outline-none"></textarea>
				{/snippet}
			</Form.Control>

			<Form.FieldErrors>
				{#snippet children({ errors })}
					{#each errors as error (error)}
						<p class="mt-1 text-sm text-red-600">
							{getErrorMessage(error)}
						</p>
					{/each}
				{/snippet}
			</Form.FieldErrors>
		</Form.Field>

		<!-- Message global -->
		{#if $formData.message === 'success'}
			<div class="alert alert-success" role="status" aria-live="polite">
				<span>
					{m.contact_form_success()}
				</span>
			</div>
		{:else if $formData.message === 'error'}
			<div class="alert alert-error" role="alert" aria-live="assertive">
				<span>
					{m.contact_form_error()}
				</span>
			</div>
		{/if}

		<!-- Bouton -->
		<button
			type="submit"
			disabled={$submitting}
			class="btn w-full border-0 bg-red-500 text-white
						shadow-sm transition-colors
						hover:bg-red-600
						disabled:cursor-not-allowed
						disabled:opacity-60"
		>
			{#if $submitting}
				<span class="loading loading-sm loading-spinner" aria-hidden="true"></span>

				{m.contact_form_sending()}
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m22 2-7 20-4-9-9-4Z" />
					<path d="M22 2 11 13" />
				</svg>

				{m.contact_form_submit()}
			{/if}
		</button>
	</form>
</section>
