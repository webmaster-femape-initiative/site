<script lang="ts">
	import { Heart, Info, LockKeyhole, RefreshCw, CreditCard, Landmark } from '@lucide/svelte';

	import { superForm } from 'sveltekit-superforms';

	import * as m from '$lib/paraglide/messages';

	import type { SuperValidated } from 'sveltekit-superforms';
	import { donationSchema, type DonationFormData } from '$lib/schemas/donation';
	import { zod4Client } from 'sveltekit-superforms/adapters';

	type Props = {
		data: SuperValidated<DonationFormData>;
	};

	let { data }: Props = $props();

	const predefinedAmounts = [10, 25, 50, 100];

	const { form, errors, message, enhance, submitting } = superForm(data, {
		validators: zod4Client(donationSchema),
		resetForm: false
	});

	/*
	 * ============================================================
	 * VALEURS DÉRIVÉES
	 * ============================================================
	 */

	const isRecurring = $derived($form.donationType === 'recurring');

	const isFixedDuration = $derived($form.duration === 'fixed');

	/*
	 * ============================================================
	 * MONTANT
	 * ============================================================
	 */

	function selectAmount(value: number) {
		$form.amount = value;
	}

	function isSelectedAmount(value: number) {
		return $form.amount === value;
	}

	/*
	 * ============================================================
	 * ERREURS
	 * ============================================================
	 *
	 * Le schéma Zod retourne volontairement des codes.
	 * On effectue ici leur traduction vers Paraglide.
	 */

	function errorMessage(code: string): string {
		switch (code) {
			case 'amount_invalid':
				return m.donation_error_amount_invalid();

			case 'amount_too_low':
				return m.donation_error_amount_too_low();

			case 'amount_too_high':
				return m.donation_error_amount_too_high();

			case 'frequency_required':
				return m.donation_error_frequency_required();

			case 'duration_required':
				return m.donation_error_duration_required();

			case 'payment_count_invalid':
				return m.donation_error_payment_count_invalid();

			case 'payment_count_required':
				return m.donation_error_payment_count_required();

			case 'payment_count_too_low':
				return m.donation_error_payment_count_too_low();

			case 'first_name_too_short':
				return m.donation_error_first_name_too_short();

			case 'first_name_too_long':
				return m.donation_error_first_name_too_long();

			case 'last_name_too_short':
				return m.donation_error_last_name_too_short();

			case 'last_name_too_long':
				return m.donation_error_last_name_too_long();

			case 'email_invalid':
				return m.donation_error_email_invalid();

			case 'email_too_long':
				return m.donation_error_email_too_long();

			case 'address_too_short':
				return m.donation_error_address_too_short();

			case 'address_too_long':
				return m.donation_error_address_too_long();

			case 'postal_code_invalid':
				return m.donation_error_postal_code_invalid();

			case 'city_too_short':
				return m.donation_error_city_too_short();

			case 'city_too_long':
				return m.donation_error_city_too_long();

			case 'country_invalid':
				return m.donation_error_country_invalid();

			default:
				return m.donation_error_generic();
		}
	}

	function firstError(fieldErrors: string[] | undefined) {
		if (!fieldErrors?.length) {
			return null;
		}

		return errorMessage(fieldErrors[0]);
	}
</script>

<section
	class="
		w-full
		bg-base-100
		px-5 py-10

		sm:px-8
		sm:py-12

		lg:px-12
		lg:py-16
	"
	aria-labelledby="donation-form-title"
>
	<div class="mx-auto max-w-4xl">
		<form
			method="POST"
			action="?/donation"
			use:enhance
			class="
				overflow-hidden
				rounded-3xl
				border border-primary/10
				bg-base-100
				shadow-sm
			"
		>
			<!-- =====================================================
			     HONEYPOT
			     ===================================================== -->

			<div class="absolute top-auto left-[-10000px] h-px w-px overflow-hidden" aria-hidden="true">
				<label for="website"> Website </label>

				<input
					id="website"
					name="website"
					type="text"
					tabindex="-1"
					autocomplete="off"
					bind:value={$form.website}
				/>
			</div>

			<input type="hidden" name="formStartedAt" bind:value={$form.formStartedAt} />

			<div class="p-5 sm:p-7 md:p-8 lg:p-10">
				<!-- =====================================================
				     TITRE
				     ===================================================== -->

				<div class="mb-7 flex items-center gap-3">
					<div
						class="
							flex size-11 shrink-0
							items-center justify-center
							rounded-full
							bg-secondary
							text-white

							sm:size-12
						"
					>
						<Heart size={24} strokeWidth={2} aria-hidden="true" />
					</div>

					<div>
						<h2
							id="donation-form-title"
							class="
								text-2xl
								font-bold
								text-primary

								sm:text-3xl
							"
						>
							{m.donation_form_title()}
						</h2>

						<p class="mt-0.5 text-sm text-primary/65">
							{m.donation_form_intro()}
						</p>
					</div>
				</div>

				<!-- =====================================================
				     TYPE DE DON
				     ===================================================== -->

				<fieldset>
					<legend class="sr-only">
						{m.donation_form_type_legend()}
					</legend>

					<div class="grid grid-cols-2 gap-3">
						<!-- DON UNIQUE -->

						<label
							class="
								cursor-pointer
								rounded-xl border
								p-4
								text-center
								transition

								{$form.donationType === 'one-off'
								? 'border-primary bg-primary/5'
								: 'border-primary/10 bg-base-200/50 hover:border-primary/30'}
							"
						>
							<input
								type="radio"
								name="donationType"
								value="one-off"
								bind:group={$form.donationType}
								class="sr-only"
							/>

							<span
								class="
									block font-bold
									{$form.donationType === 'one-off' ? 'text-primary' : 'text-primary/80'}
								"
							>
								{m.donation_form_type_one_off()}
							</span>

							<span
								class="
									mt-1 block
									text-xs text-primary/60

									sm:text-sm
								"
							>
								{m.donation_form_type_one_off_description()}
							</span>
						</label>

						<!-- DON RÉCURRENT -->

						<label
							class="
								cursor-pointer
								rounded-xl border
								p-4
								text-center
								transition

								{$form.donationType === 'recurring'
								? 'border-primary bg-primary/5'
								: 'border-primary/10 bg-base-200/50 hover:border-primary/30'}
							"
						>
							<input
								type="radio"
								name="donationType"
								value="recurring"
								bind:group={$form.donationType}
								class="sr-only"
							/>

							<span
								class="
									flex items-center
									justify-center gap-2
									font-bold

									{$form.donationType === 'recurring' ? 'text-primary' : 'text-primary/80'}
								"
							>
								<RefreshCw size={16} strokeWidth={2} aria-hidden="true" />

								{m.donation_form_type_recurring()}
							</span>

							<span
								class="
									mt-1 block
									text-xs text-primary/60

									sm:text-sm
								"
							>
								{m.donation_form_type_recurring_description()}
							</span>
						</label>
					</div>
				</fieldset>

				<!-- =====================================================
				     MONTANT
				     ===================================================== -->

				<fieldset class="mt-7">
					<legend class="mb-3 font-bold text-primary">
						{isRecurring ? m.donation_form_recurring_amount() : m.donation_form_amount()}
					</legend>

					<div
						class="
							grid grid-cols-2 gap-3

							sm:grid-cols-6
						"
					>
						{#each predefinedAmounts as value (value)}
							<button
								type="button"
								class="
									h-12
									rounded-xl border
									font-semibold
									transition

									sm:col-span-1

									{isSelectedAmount(value)
									? 'border-primary bg-primary text-white'
									: 'border-primary/15 bg-base-100 text-primary hover:border-primary/40'}
								"
								onclick={() => selectAmount(value)}
								aria-pressed={isSelectedAmount(value)}
							>
								{value} €
							</button>
						{/each}

						<!-- AUTRE MONTANT -->

						<div
							class="
								col-span-2
								flex h-12 min-w-0
								items-center
								overflow-hidden
								rounded-xl border
								border-primary/15
								bg-base-100

								focus-within:border-primary

								sm:col-span-2
							"
						>
							<label for="amount" class="sr-only">
								{m.donation_form_custom_amount()}
							</label>

							<input
								id="amount"
								name="amount"
								type="number"
								min="2"
								step="0.01"
								inputmode="decimal"
								placeholder={m.donation_form_custom_amount()}
								bind:value={$form.amount}
								class="
									w-0 min-w-0 flex-1
									bg-transparent
									px-3
									text-sm text-primary
									outline-none
								"
							/>

							<span
								class="
									shrink-0
									pr-3
									font-semibold
									text-primary
								"
							>
								€
							</span>
						</div>
					</div>

					<p class="mt-2 text-xs text-primary/55">
						{m.donation_form_minimum_amount()}
					</p>

					{#if firstError($errors.amount)}
						<p class="mt-2 text-sm text-error">
							{firstError($errors.amount)}
						</p>
					{/if}
				</fieldset>

				<!-- =====================================================
				     DON RÉCURRENT
				     ===================================================== -->

				{#if isRecurring}
					<div class="mt-7 space-y-6">
						<!-- =============================================
						     FRÉQUENCE
						     ============================================= -->

						<fieldset>
							<legend class="mb-3 font-bold text-primary">
								{m.donation_form_frequency()}
							</legend>

							<div
								class="
									grid grid-cols-1 gap-3

									sm:grid-cols-2
								"
							>
								<!-- MENSUEL -->

								<label
									class="
										flex cursor-pointer
										items-start gap-3
										rounded-xl border
										p-4
										transition

										{$form.frequency === 'monthly'
										? 'border-primary bg-primary/5'
										: 'border-primary/10 bg-base-200/40 hover:border-primary/30'}
									"
								>
									<input
										type="radio"
										name="frequency"
										value="monthly"
										bind:group={$form.frequency}
										class="
											radio mt-0.5
											radio-sm radio-primary
										"
									/>

									<span>
										<span
											class="
												block
												font-semibold
												text-primary
											"
										>
											{m.donation_form_frequency_monthly()}
										</span>

										<span
											class="
												mt-0.5 block
												text-sm
												text-primary/60
											"
										>
											{m.donation_form_frequency_monthly_description()}
										</span>
									</span>
								</label>

								<!-- TRIMESTRIEL -->

								<label
									class="
										flex cursor-pointer
										items-start gap-3
										rounded-xl border
										p-4
										transition

										{$form.frequency === 'quarterly'
										? 'border-primary bg-primary/5'
										: 'border-primary/10 bg-base-200/40 hover:border-primary/30'}
									"
								>
									<input
										type="radio"
										name="frequency"
										value="quarterly"
										bind:group={$form.frequency}
										class="
											radio mt-0.5
											radio-sm radio-primary
										"
									/>

									<span>
										<span
											class="
												block
												font-semibold
												text-primary
											"
										>
											{m.donation_form_frequency_quarterly()}
										</span>

										<span
											class="
												mt-0.5 block
												text-sm
												text-primary/60
											"
										>
											{m.donation_form_frequency_quarterly_description()}
										</span>
									</span>
								</label>
							</div>

							{#if firstError($errors.frequency)}
								<p class="mt-2 text-sm text-error">
									{firstError($errors.frequency)}
								</p>
							{/if}
						</fieldset>

						<!-- =============================================
						     DURÉE
						     ============================================= -->

						<fieldset>
							<legend class="mb-3 font-bold text-primary">
								{m.donation_form_duration()}
							</legend>

							<div
								class="
									space-y-4
									rounded-xl
									border border-primary/10
									bg-base-200/40
									p-4
								"
							>
								<!-- SANS LIMITE -->

								<label
									class="
										flex cursor-pointer
										items-start gap-3
									"
								>
									<input
										type="radio"
										name="duration"
										value="unlimited"
										bind:group={$form.duration}
										class="
											radio mt-0.5
											radio-sm radio-primary
										"
									/>

									<span>
										<span
											class="
												block
												font-semibold
												text-primary
											"
										>
											{m.donation_form_duration_unlimited()}
										</span>

										<span
											class="
												mt-0.5 block
												text-sm
												text-primary/60
											"
										>
											{m.donation_form_duration_unlimited_description()}
										</span>
									</span>
								</label>

								<!-- DURÉE FIXE -->

								<label
									class="
										flex cursor-pointer
										items-start gap-3
									"
								>
									<input
										type="radio"
										name="duration"
										value="fixed"
										bind:group={$form.duration}
										class="
											radio mt-0.5
											radio-sm radio-primary
										"
									/>

									<span class="min-w-0 flex-1">
										<span
											class="
												block
												font-semibold
												text-primary
											"
										>
											{m.donation_form_duration_fixed()}
										</span>

										<span
											class="
												mt-0.5 block
												text-sm
												text-primary/60
											"
										>
											{m.donation_form_duration_fixed_description()}
										</span>

										{#if isFixedDuration}
											<div class="mt-3 max-w-xs">
												<label
													for="payment-count"
													class="
														mb-2 block
														text-sm
														font-semibold
														text-primary
													"
												>
													{m.donation_form_payment_count()}
												</label>

												<input
													id="payment-count"
													name="paymentCount"
													type="number"
													min="2"
													step="1"
													bind:value={$form.paymentCount}
													class="
														input
														w-full
														border-primary/15
														bg-base-100
														text-primary
														focus:border-primary
													"
												/>

												{#if firstError($errors.paymentCount)}
													<p class="mt-2 text-sm text-error">
														{firstError($errors.paymentCount)}
													</p>
												{/if}
											</div>
										{/if}
									</span>
								</label>
							</div>

							{#if firstError($errors.duration)}
								<p class="mt-2 text-sm text-error">
									{firstError($errors.duration)}
								</p>
							{/if}
						</fieldset>
					</div>
				{/if}

				<!-- =====================================================
				     MOYEN DE PAIEMENT
				     ===================================================== -->

				<fieldset class="mt-7">
					<legend class="mb-3 font-bold text-primary">
						{m.donation_form_payment_method()}
					</legend>

					<div
						class="
							grid grid-cols-1 gap-3

							sm:grid-cols-2
						"
					>
						<!-- CARTE -->

						<label
							class="
								flex cursor-pointer
								items-start gap-3
								rounded-xl border
								p-4
								transition

								{$form.paymentMethod === 'card'
								? 'border-primary bg-primary/5'
								: 'border-primary/10 bg-base-200/40 hover:border-primary/30'}
							"
						>
							<input
								type="radio"
								name="paymentMethod"
								value="card"
								bind:group={$form.paymentMethod}
								class="
									radio mt-0.5
									radio-sm radio-primary
								"
							/>

							<CreditCard
								size={22}
								strokeWidth={2}
								class="shrink-0 text-primary"
								aria-hidden="true"
							/>

							<span>
								<span
									class="
										block
										font-semibold
										text-primary
									"
								>
									{m.donation_form_payment_card()}
								</span>

								<span
									class="
										mt-0.5 block
										text-sm
										text-primary/60
									"
								>
									{m.donation_form_payment_card_description()}
								</span>
							</span>
						</label>

						<!-- SEPA -->

						<label
							class="
								flex cursor-pointer
								items-start gap-3
								rounded-xl border
								p-4
								transition

								{$form.paymentMethod === 'sepa'
								? 'border-primary bg-primary/5'
								: 'border-primary/10 bg-base-200/40 hover:border-primary/30'}
							"
						>
							<input
								type="radio"
								name="paymentMethod"
								value="sepa"
								bind:group={$form.paymentMethod}
								class="
									radio mt-0.5
									radio-sm radio-primary
								"
							/>

							<Landmark
								size={22}
								strokeWidth={2}
								class="shrink-0 text-primary"
								aria-hidden="true"
							/>

							<span>
								<span
									class="
										block
										font-semibold
										text-primary
									"
								>
									{m.donation_form_payment_sepa()}
								</span>

								<span
									class="
										mt-0.5 block
										text-sm
										text-primary/60
									"
								>
									{m.donation_form_payment_sepa_description()}
								</span>
							</span>
						</label>
					</div>
				</fieldset>

				<!-- =====================================================
				     SÉPARATEUR
				     ===================================================== -->

				<div class="my-8 border-t border-primary/10"></div>

				<!-- =====================================================
				     COORDONNÉES
				     ===================================================== -->

				<fieldset>
					<legend
						class="
							text-xl
							font-bold
							text-primary

							sm:text-2xl
						"
					>
						{m.donation_form_details_title()}
					</legend>

					<p class="mt-1 text-sm text-primary/60">
						{m.donation_form_details_description()}
					</p>

					<div
						class="
							mt-6
							grid grid-cols-1
							gap-x-5 gap-y-5

							sm:grid-cols-2
						"
					>
						<!-- PRÉNOM -->

						<div>
							<label
								for="first-name"
								class="
									mb-2 block
									text-sm font-semibold
									text-primary
								"
							>
								{m.donation_form_first_name()}

								<span class="text-secondary">*</span>
							</label>

							<input
								id="first-name"
								name="firstName"
								type="text"
								autocomplete="given-name"
								bind:value={$form.firstName}
								aria-invalid={$errors.firstName?.length ? 'true' : undefined}
								class="
									input
									w-full
									border-primary/15
									bg-base-100
									text-primary
									focus:border-primary
								"
							/>

							{#if firstError($errors.firstName)}
								<p class="mt-1.5 text-sm text-error">
									{firstError($errors.firstName)}
								</p>
							{/if}
						</div>

						<!-- NOM -->

						<div>
							<label
								for="last-name"
								class="
									mb-2 block
									text-sm font-semibold
									text-primary
								"
							>
								{m.donation_form_last_name()}

								<span class="text-secondary">*</span>
							</label>

							<input
								id="last-name"
								name="lastName"
								type="text"
								autocomplete="family-name"
								bind:value={$form.lastName}
								aria-invalid={$errors.lastName?.length ? 'true' : undefined}
								class="
									input
									w-full
									border-primary/15
									bg-base-100
									text-primary
									focus:border-primary
								"
							/>

							{#if firstError($errors.lastName)}
								<p class="mt-1.5 text-sm text-error">
									{firstError($errors.lastName)}
								</p>
							{/if}
						</div>

						<!-- EMAIL -->

						<div class="sm:col-span-2">
							<label
								for="email"
								class="
									mb-2 block
									text-sm font-semibold
									text-primary
								"
							>
								{m.donation_form_email()}

								<span class="text-secondary">*</span>
							</label>

							<input
								id="email"
								name="email"
								type="email"
								autocomplete="email"
								bind:value={$form.email}
								aria-invalid={$errors.email?.length ? 'true' : undefined}
								class="
									input
									w-full
									border-primary/15
									bg-base-100
									text-primary
									focus:border-primary
								"
							/>

							{#if firstError($errors.email)}
								<p class="mt-1.5 text-sm text-error">
									{firstError($errors.email)}
								</p>
							{/if}
						</div>

						<!-- ADRESSE -->

						<div class="sm:col-span-2">
							<label
								for="address"
								class="
									mb-2 block
									text-sm font-semibold
									text-primary
								"
							>
								{m.donation_form_address()}

								<span class="text-secondary">*</span>
							</label>

							<input
								id="address"
								name="address"
								type="text"
								autocomplete="street-address"
								bind:value={$form.address}
								aria-invalid={$errors.address?.length ? 'true' : undefined}
								class="
									input
									w-full
									border-primary/15
									bg-base-100
									text-primary
									focus:border-primary
								"
							/>

							{#if firstError($errors.address)}
								<p class="mt-1.5 text-sm text-error">
									{firstError($errors.address)}
								</p>
							{/if}
						</div>

						<!-- CODE POSTAL -->

						<div>
							<label
								for="postal-code"
								class="
									mb-2 block
									text-sm font-semibold
									text-primary
								"
							>
								{m.donation_form_postal_code()}

								<span class="text-secondary">*</span>
							</label>

							<input
								id="postal-code"
								name="postalCode"
								type="text"
								autocomplete="postal-code"
								bind:value={$form.postalCode}
								aria-invalid={$errors.postalCode?.length ? 'true' : undefined}
								class="
									input
									w-full
									border-primary/15
									bg-base-100
									text-primary
									focus:border-primary
								"
							/>

							{#if firstError($errors.postalCode)}
								<p class="mt-1.5 text-sm text-error">
									{firstError($errors.postalCode)}
								</p>
							{/if}
						</div>

						<!-- VILLE -->

						<div>
							<label
								for="city"
								class="
									mb-2 block
									text-sm font-semibold
									text-primary
								"
							>
								{m.donation_form_city()}

								<span class="text-secondary">*</span>
							</label>

							<input
								id="city"
								name="city"
								type="text"
								autocomplete="address-level2"
								bind:value={$form.city}
								aria-invalid={$errors.city?.length ? 'true' : undefined}
								class="
									input
									w-full
									border-primary/15
									bg-base-100
									text-primary
									focus:border-primary
								"
							/>

							{#if firstError($errors.city)}
								<p class="mt-1.5 text-sm text-error">
									{firstError($errors.city)}
								</p>
							{/if}
						</div>

						<!-- PAYS -->

						<div class="sm:col-span-2">
							<label
								for="country"
								class="
									mb-2 block
									text-sm font-semibold
									text-primary
								"
							>
								{m.donation_form_country()}

								<span class="text-secondary">*</span>
							</label>

							<select
								id="country"
								name="country"
								autocomplete="country"
								bind:value={$form.country}
								aria-invalid={$errors.country?.length ? 'true' : undefined}
								class="
									select
									w-full
									border-primary/15
									bg-base-100
									text-primary
									focus:border-primary
								"
							>
								<option value="FR">
									{m.donation_form_country_france()}
								</option>

								<option value="BE">
									{m.donation_form_country_belgium()}
								</option>

								<option value="LU">
									{m.donation_form_country_luxembourg()}
								</option>

								<option value="CH">
									{m.donation_form_country_switzerland()}
								</option>

								<option value="GB">
									{m.donation_form_country_united_kingdom()}
								</option>
							</select>

							{#if firstError($errors.country)}
								<p class="mt-1.5 text-sm text-error">
									{firstError($errors.country)}
								</p>
							{/if}
						</div>
					</div>
				</fieldset>

				<!-- =====================================================
				     INFORMATION MOLLIE
				     ===================================================== -->

				<div
					class="
						mt-8
						flex items-start gap-3
						rounded-xl
						bg-sky-50
						p-4
						text-primary
					"
				>
					<Info
						size={21}
						strokeWidth={2}
						class="
							mt-0.5 shrink-0
							text-sky-500
						"
						aria-hidden="true"
					/>

					<p class="text-sm leading-relaxed">
						{isRecurring ? m.donation_form_mollie_recurring() : m.donation_form_mollie_one_off()}
					</p>
				</div>

				<!-- =====================================================
				     SUBMIT
				     ===================================================== -->

				<button
					type="submit"
					disabled={$submitting}
					class="
						mt-5
						flex min-h-13 w-full
						items-center justify-center
						gap-3
						rounded-xl
						bg-secondary
						px-5 py-3

						text-base
						font-bold
						text-white

						transition

						hover:bg-secondary/90

						focus-visible:outline-2
						focus-visible:outline-offset-2
						focus-visible:outline-secondary

						disabled:cursor-not-allowed
						disabled:opacity-60

						sm:text-lg
					"
				>
					{#if $submitting}
						<span
							class="
								loading
								loading-sm
								loading-spinner
							"
							aria-hidden="true"
						></span>

						{m.donation_form_submitting()}
					{:else}
						<LockKeyhole size={20} strokeWidth={2} aria-hidden="true" />

						{#if isRecurring}
							{#if $form.frequency === 'quarterly'}
								{m.donation_form_submit_quarterly({
									amount: $form.amount ?? 0
								})}
							{:else}
								{m.donation_form_submit_monthly({
									amount: $form.amount ?? 0
								})}
							{/if}
						{:else}
							{m.donation_form_submit_one_off({
								amount: $form.amount ?? 0
							})}
						{/if}

						<span aria-hidden="true">→</span>
					{/if}
				</button>

				<p
					class="
						mt-3
						text-center
						text-xs
						leading-relaxed
						text-primary/50
					"
				>
					{m.donation_form_secure_payment()}
				</p>
			</div>
		</form>
		{#if $message?.status === 'error'}
			<div class="mt-5 rounded-xl bg-error/10 p-4 text-sm text-error" role="alert">
				{m.donation_error_submission_rejected()}
			</div>
		{/if}

		{#if $message?.status === 'success'}
			<div class="mt-5 rounded-xl bg-success/10 p-4 text-sm text-success" role="status">
				{m.donation_form_validation_success()}
			</div>
		{/if}
	</div>
</section>
