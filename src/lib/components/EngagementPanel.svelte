<script lang="ts">
	import * as Form from 'formsnap';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { Send } from '@lucide/svelte';

	import * as m from '$lib/paraglide/messages';

	import { engagementSchema, type EngagementSchema } from '$lib/schemas/engagement';

	import type { SuperValidated } from 'sveltekit-superforms';

	type Props = {
		data: SuperValidated<EngagementSchema>;
	};

	let { data }: Props = $props();

	const form = superForm(data, {
		validators: zod4Client(engagementSchema),
		resetForm: true
	});

	const { form: formData, errors, enhance, submitting, message } = form;

	function translateError(error: string): string {
		switch (error) {
			case 'name_too_short':
				return m.engagement_error_name_too_short();

			case 'name_too_long':
				return m.engagement_error_name_too_long();

			case 'email_invalid':
				return m.engagement_error_email_invalid();

			case 'message_too_short':
				return m.engagement_error_message_too_short();

			case 'message_too_long':
				return m.engagement_error_message_too_long();

			case 'consent_required':
				return m.engagement_error_consent_required();

			default:
				return error;
		}
	}

	function translateMessage(message: string): string {
		switch (message) {
			case 'engagement_success':
				return m.engagement_success();

			case 'engagement_send_error':
				return m.engagement_send_error();

			default:
				return message;
		}
	}
</script>

<section class="bg-white">
	<div
		class="
			mx-auto w-full
			px-4 py-10
			sm:px-6 sm:py-12
			md:px-8
			lg:px-10 lg:py-14
			xl:px-12
			2xl:px-16
		"
	>
		<div
			class="
				grid gap-8
				lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]
				lg:items-start lg:gap-12
				xl:grid-cols-[minmax(300px,0.7fr)_minmax(600px,1.3fr)]
				xl:gap-16
			"
		>
			<!-- ==================================================
			     INTRODUCTION
			     ================================================== -->

			<div>
				<h2
					class="
						text-2xl leading-tight font-bold
						tracking-tight text-[#063b7c]
						sm:text-3xl
						lg:text-4xl
						xl:text-5xl
						2xl:text-6xl
						3xl:text-7xl
					"
				>
					{m.engagement_title()}
				</h2>

				<div
					class="
						mt-4 h-0.75 w-10
						rounded-full bg-[#ef233c]
					"
				></div>

				<p
					class="
						mt-6 text-sm leading-6
						text-primary
						sm:text-base sm:leading-7
						lg:text-lg
						xl:text-xl
						2xl:text-2xl
						3xl:text-3xl
					"
				>
					{m.engagement_description()}
				</p>
			</div>

			<!-- ==================================================
			     FORMULAIRE
			     ================================================== -->

			<div
				class="
					rounded-xl border border-[#d8e7f5]
					bg-white p-5
					sm:p-6
					lg:p-7
				"
			>
				<h3
					class="
						mb-6 text-lg font-bold
						text-[#063b7c]
						sm:text-xl
						lg:text-2xl
						xl:text-3xl
						2xl:text-4xl
						3xl:text-5xl
					"
				>
					{m.engagement_form_title()}
				</h3>

				<form method="POST" action="?/engagement" use:enhance class="space-y-5">
					<!--
    Honeypot anti-spam.

    Ce champ doit rester vide.
    Il est placé hors écran plutôt qu'en display:none,
    afin que les bots qui ignorent les champs invisibles
    puissent néanmoins le détecter et le remplir.
-->
					<div
						class="absolute top-auto left-[-9999px] h-px w-px overflow-hidden"
						aria-hidden="true"
					>
						<label for="engagement-website"> Website </label>

						<input
							id="engagement-website"
							name="website"
							type="text"
							tabindex="-1"
							autocomplete="off"
						/>
					</div>
					<div class="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
						<!-- COLONNE GAUCHE -->
						<div class="flex flex-col gap-5">
							<!-- Nom -->
							<Form.Field {form} name="name">
								<Form.Control>
									{#snippet children({ props })}
										<div>
											<label
												for="engagement-name"
												class="mb-2 block text-sm font-semibold text-[#063b7c]"
											>
												{m.engagement_name_label()}
											</label>

											<input
												{...props}
												id="engagement-name"
												type="text"
												bind:value={$formData.name}
												placeholder={m.engagement_name_placeholder()}
												class="
									input-bordered input
									h-11 w-full
									bg-white text-[#063b7c]
									focus:border-[#0878e8]
									focus:outline-none
								"
											/>
										</div>
									{/snippet}
								</Form.Control>

								{#if $errors.name}
									{#each $errors.name as error (error)}
										<p class="mt-1 text-xs text-[#d90429]">
											{translateError(error)}
										</p>
									{/each}
								{/if}
							</Form.Field>

							<!-- Sujet -->
							<Form.Field {form} name="subject">
								<Form.Control>
									{#snippet children({ props })}
										<div>
											<label
												for="engagement-subject"
												class="mb-2 block text-sm font-semibold text-[#063b7c]"
											>
												{m.engagement_subject_label()}
											</label>

											<select
												{...props}
												id="engagement-subject"
												bind:value={$formData.subject}
												class="
									select-bordered select
									h-11 w-full
									bg-white text-[#063b7c]
									focus:border-[#0878e8]
									focus:outline-none
								"
											>
												<option value="volunteer">
													{m.engagement_subject_volunteer()}
												</option>

												<option value="partnership">
													{m.engagement_subject_partnership()}
												</option>

												<option value="information">
													{m.engagement_subject_information()}
												</option>

												<option value="other">
													{m.engagement_subject_other()}
												</option>
											</select>
										</div>
									{/snippet}
								</Form.Control>

								{#if $errors.subject}
									{#each $errors.subject as error (error)}
										<p class="mt-1 text-xs text-[#d90429]">
											{translateError(error)}
										</p>
									{/each}
								{/if}
							</Form.Field>
						</div>

						<!-- COLONNE DROITE -->
						<div class="flex flex-col gap-5">
							<!-- Email -->
							<Form.Field {form} name="email">
								<Form.Control>
									{#snippet children({ props })}
										<div>
											<label
												for="engagement-email"
												class="mb-2 block text-sm font-semibold text-[#063b7c]"
											>
												{m.engagement_email_label()}
											</label>

											<input
												{...props}
												id="engagement-email"
												type="email"
												bind:value={$formData.email}
												placeholder={m.engagement_email_placeholder()}
												class="
									input-bordered input
									h-11 w-full
									bg-white text-[#063b7c]
									focus:border-[#0878e8]
									focus:outline-none
								"
											/>
										</div>
									{/snippet}
								</Form.Control>

								{#if $errors.email}
									{#each $errors.email as error (error)}
										<p class="mt-1 text-xs text-[#d90429]">
											{translateError(error)}
										</p>
									{/each}
								{/if}
							</Form.Field>

							<!-- Message -->
							<Form.Field {form} name="message">
								<Form.Control>
									{#snippet children({ props })}
										<div>
											<label
												for="engagement-message"
												class="mb-2 block text-sm font-semibold text-[#063b7c]"
											>
												{m.engagement_message_label()}
											</label>

											<textarea
												{...props}
												id="engagement-message"
												bind:value={$formData.message}
												placeholder={m.engagement_message_placeholder()}
												rows="4"
												class="
									textarea-bordered textarea
									min-h-28 w-full resize-y
									bg-white text-[#063b7c]
									focus:border-[#0878e8]
									focus:outline-none
								"></textarea>
										</div>
									{/snippet}
								</Form.Control>

								{#if $errors.message}
									{#each $errors.message as error (error)}
										<p class="mt-1 text-xs text-[#d90429]">
											{translateError(error)}
										</p>
									{/each}
								{/if}
							</Form.Field>
						</div>
					</div>

					<!-- Consentement -->
					<Form.Field {form} name="consent">
						<div>
							<div class="flex items-start gap-3">
								<Form.Control>
									{#snippet children({ props })}
										<input
											{...props}
											id="engagement-consent"
											type="checkbox"
											bind:checked={$formData.consent}
											class="
								checkbox mt-0.5
								border-[#9db9d5]
								checkbox-sm
								checked:border-primary
								checked:bg-primary
							"
										/>
									{/snippet}
								</Form.Control>

								<label
									for="engagement-consent"
									class="cursor-pointer text-xs leading-5 text-[#063b7c]"
								>
									{m.engagement_consent()}
								</label>
							</div>

							{#if $errors.consent}
								{#each $errors.consent as error (error)}
									<p class="mt-1 pl-8 text-xs text-[#d90429]">
										{translateError(error)}
									</p>
								{/each}
							{/if}
						</div>
					</Form.Field>
					{#if $message}
						<div
							role={$message === 'engagement_success' ? 'status' : 'alert'}
							class={[
								'rounded-lg border px-4 py-3 text-sm',
								$message === 'engagement_success'
									? 'border-green-200 bg-green-50 text-green-800'
									: 'border-red-200 bg-red-50 text-red-800'
							]}
						>
							{translateMessage($message)}
						</div>
					{/if}
					<!-- Bouton -->
					<div class="flex justify-end">
						<button
							type="submit"
							disabled={$submitting}
							class="
				btn w-full border-0
				bg-[#063b7c] text-white
				hover:bg-primary
				sm:w-auto sm:min-w-64
			"
						>
							{#if $submitting}
								<span class="loading loading-sm loading-spinner"></span>
								{m.engagement_sending()}
							{:else}
								<Send size={17} strokeWidth={2} aria-hidden="true" />

								{m.engagement_submit()}
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
</section>
