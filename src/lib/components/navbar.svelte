<script lang="ts">
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import { setLocale } from '$lib/paraglide/runtime';
	import { m } from '$lib/paraglide/messages.js';
	import logo from '$lib/assets/logo-nav.png';
	import union_jack_flag from '$lib/assets/union-jack-flag.png';
	import french_flag from '$lib/assets/french-flag.png';
</script>

<nav class="navbar bg-base-100 shadow-sm">
	<div class="navbar-start">
		<div class="dropdown">
			<div tabindex="0" role="button" class="btn btn-ghost lg:hidden">
				<svg
					aria-label="Menu"
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h8m-8 6h16"
					/>
				</svg>
			</div>
			<ul
				tabindex="-1"
				class="menu dropdown-content z-1 mt-3 w-52 menu-sm rounded-box bg-base-100 p-2 shadow"
			>
				<li><a class="text-lg" href={localizeHref('/')}>{m.home()}</a></li>
				<li>
					<a class="text-lg" href={localizeHref('/about')}>{m.about()}</a>
				</li>
			</ul>
		</div>
		<a href={localizeHref('/')}><img src={logo} alt="logo FEMAPE initiative" /></a>
	</div>
	<div class="navbar-center hidden lg:flex">
		<ul class="menu menu-horizontal px-1">
			<li><a class="text-lg" href={localizeHref('/')}>{m.home()}</a></li>
			<li><a class="text-lg" href={localizeHref('/about')}>{m.about()}</a></li>
		</ul>
	</div>
	<div class="navbar-end">
		<button class="btn btn-ghost" onclick={() => setLocale('en')}
			><img class="w-6 md:w-8 lg:w-10" src={union_jack_flag} alt={m.english_flag()} /></button
		>
		<button class="btn btn-ghost" onclick={() => setLocale('fr')}
			><img class="w-6 md:w-8 lg:w-10" src={french_flag} alt={m.freanch_flag()} /></button
		>
	</div>
</nav>
