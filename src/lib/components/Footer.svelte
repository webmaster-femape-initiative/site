<script lang="ts">
	import {
		SiFacebook,
		SiInstagram,
		SiTiktok,
		SiYoutube,
		SiX
	} from '@icons-pack/svelte-simple-icons';

	import { localizeHref } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	import logo from '$lib/assets/logo-footer.png';
	import linkedinLogo from '$lib/assets/linkedin.png';

	/**
	 * Navigation interne du site.
	 */
	const navigation = [
		{
			label: () => m.footer_home(),
			href: '/'
		},
		{
			label: () => m.footer_about(),
			href: '/about'
		},
		{
			label: () => m.footer_programs(),
			href: '/programs'
		},
		{
			label: () => m.footer_news(),
			href: '/news'
		},
		{
			label: () => m.footer_support(),
			href: '/support'
		},
		{
			label: () => m.footer_contact(),
			href: '/contact'
		}
	];

	/**
	 * Réseaux sociaux disponibles dans Simple Icons.
	 *
	 * LinkedIn est volontairement géré séparément
	 * avec son PNG officiel.
	 */
	const socialLinks = [
		{
			name: 'Facebook',
			href: 'https://www.facebook.com/femapefrance',
			icon: SiFacebook
		},
		{
			name: 'Instagram',
			href: 'https://www.instagram.com/assofemape/',
			icon: SiInstagram
		},
		{
			name: 'TikTok',
			href: 'https://www.tiktok.com/@femape.i',
			icon: SiTiktok
		},
		{
			name: 'YouTube',
			href: 'https://www.youtube.com/channel/UCX2K0WRqnwjhYUKk8JgG0sg',
			icon: SiYoutube
		},
		{
			name: 'X',
			href: 'https://x.com/femapei2025',
			icon: SiX
		}
	];

	const linkedinHref = 'https://www.linkedin.com/company/organidation-femape/';

	const currentYear = new Date().getFullYear();
</script>

<footer class="bg-primary text-primary-content">
	<!-- =========================================================
         Contenu principal
         ========================================================= -->

	<div
		class="
            mx-auto w-full
            px-5 py-10

            sm:px-6
            sm:py-12

            lg:px-8

            xl:px-12
            xl:py-14

            2xl:px-16
        "
	>
		<div
			class="
                grid grid-cols-1
                gap-10

                sm:grid-cols-2
                sm:gap-x-10

                lg:grid-cols-[1.1fr_1.1fr_1fr_1.5fr]
                lg:gap-10

                xl:gap-14
            "
		>
			<!-- =================================================
                 Identité
                 ================================================= -->

			<div
				class="
                    sm:col-span-2
                    lg:col-span-1
                "
			>
				<a href={localizeHref('/')} aria-label={m.footer_home()} class="inline-block">
					<img
						src={logo}
						alt="FEMAPE Initiative"
						class="
                            h-auto
                            w-48
                            max-w-full

                            lg:w-52
                        "
					/>
				</a>
			</div>

			<!-- =================================================
                 Navigation
                 ================================================= -->

			<nav aria-label={m.footer_navigation()}>
				<h2
					class="
                        mb-5
                        text-lg font-bold
                        text-white

                        xl:text-xl
                    "
				>
					{m.footer_navigation()}
				</h2>

				<ul
					class="
                        grid grid-cols-1
                        gap-x-6 gap-y-3

                        xl:grid-cols-2
                    "
				>
					{#each navigation as item (item.label)}
						<li>
							<a
								href={localizeHref(item.href)}
								class="
                                    text-sm
                                    text-white/80

                                    transition-colors
                                    duration-200

                                    hover:text-white
                                "
							>
								{item.label()}
							</a>
						</li>
					{/each}
				</ul>
			</nav>

			<!-- =================================================
                 Réseaux sociaux
                 ================================================= -->

			<section aria-labelledby="footer-social-title">
				<h2
					id="footer-social-title"
					class="
                        mb-5
                        text-lg font-bold
                        text-white

                        xl:text-xl
                    "
				>
					{m.footer_followUs()}
				</h2>

				<div class="flex flex-wrap gap-2.5">
					<!-- =========================================
                         Simple Icons
                         ========================================= -->

					{#each socialLinks as social (social.name)}
						<a
							href={social.href}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={social.name}
							title={social.name}
							class="
                                flex size-10
                                items-center justify-center

                                rounded-lg
                                bg-white

                                text-primary

                                shadow-sm

                                transition-all
                                duration-200

                                hover:-translate-y-0.5
                                hover:shadow-md

                                focus-visible:outline-2
                                focus-visible:outline-offset-2
                                focus-visible:outline-white
                            "
						>
							<social.icon size={19} aria-hidden="true" />
						</a>
					{/each}

					<!-- =========================================
                         LinkedIn
                         ========================================= -->

					<a
						href={linkedinHref}
						target="_blank"
						rel="noopener noreferrer"
						aria-label="LinkedIn"
						title="LinkedIn"
						class="
                            flex size-10
                            items-center justify-center

                            rounded-lg
                            bg-white

                            shadow-sm

                            transition-all
                            duration-200

                            hover:-translate-y-0.5
                            hover:shadow-md

                            focus-visible:outline-2
                            focus-visible:outline-offset-2
                            focus-visible:outline-white
                        "
					>
						<img
							src={linkedinLogo}
							alt=""
							aria-hidden="true"
							class="
                                size-5
                                object-contain
                            "
						/>
					</a>
				</div>
			</section>

			<!-- =================================================
                 Newsletter
                 ================================================= -->

			<section aria-labelledby="footer-newsletter-title">
				<h2
					id="footer-newsletter-title"
					class="
                        mb-3
                        text-lg font-bold
                        text-white

                        xl:text-xl
                    "
				>
					{m.footer_stayInformed()}
				</h2>

				<p
					class="
                        mb-5
                        max-w-lg

                        text-sm leading-relaxed
                        text-white/80

                        xl:text-base
                    "
				>
					{m.footer_newsletterDescription()}
				</p>

				<!--
                    Le traitement du formulaire sera ajouté
                    ultérieurement.
                -->

				<form
					class="
                        flex w-full
                        max-w-xl

                        overflow-hidden
                        rounded-lg

                        bg-white
                        p-1
                    "
				>
					<label for="footer-email" class="sr-only">
						{m.footer_emailLabel()}
					</label>

					<input
						id="footer-email"
						type="email"
						name="email"
						autocomplete="email"
						required
						placeholder={m.footer_emailPlaceholder()}
						class="
                            min-w-0 flex-1

                            bg-transparent
                            px-3 py-2

                            text-sm
                            text-base-content

                            outline-none

                            placeholder:text-base-content/45

                            sm:px-4
                        "
					/>

					<button
						type="submit"
						class="
                            shrink-0

                            cursor-pointer
                            rounded-md

                            bg-primary
                            px-4 py-2

                            text-sm font-semibold
                            text-primary-content

                            transition-opacity

                            hover:opacity-90

                            sm:px-5
                        "
					>
						{m.footer_subscribe()}
					</button>
				</form>
			</section>
		</div>
	</div>

	<!-- =========================================================
         Partie inférieure
         ========================================================= -->

	<div class="border-t border-white/20">
		<div
			class="
                mx-auto flex w-full
                flex-col gap-4

                px-5 py-5

                text-xs
                text-white/65

                sm:px-6

                md:flex-row
                md:items-center
                md:justify-between

                lg:px-8

                xl:px-12

                2xl:px-16
            "
		>
			<!-- =================================================
                 Copyright
                 ================================================= -->

			<p>
				{m.footer_copyright({
					year: currentYear
				})}
			</p>

			<!-- =================================================
                 Navigation légale
                 ================================================= -->

			<nav aria-label={m.footer_legalNavigation()}>
				<ul
					class="
                        flex flex-wrap
                        items-center
                        gap-x-3 gap-y-2

                        sm:gap-x-4
                    "
				>
					<li>
						<a
							href={localizeHref('/legal')}
							class="
                                transition-colors
                                duration-200

                                hover:text-white
                            "
						>
							{m.footer_legalNotice()}
						</a>
					</li>

					<li aria-hidden="true" class="text-white/25">|</li>

					<li>
						<a
							href={localizeHref('/privacy')}
							class="
                                transition-colors
                                duration-200

                                hover:text-white
                            "
						>
							{m.footer_privacy()}
						</a>
					</li>

					<li aria-hidden="true" class="text-white/25">|</li>

					<li>
						<a
							href={localizeHref('/contact')}
							class="
                                transition-colors
                                duration-200

                                hover:text-white
                            "
						>
							{m.footer_contact()}
						</a>
					</li>
				</ul>
			</nav>
		</div>
	</div>
</footer>
