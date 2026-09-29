<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';

	// Coordonnées provisoires à remplacer par celles de FEMAPE Initiative.
	const latitude = 48.8268;
	const longitude = 2.3094;

	let mapElement: HTMLDivElement;

	onMount(() => {
		let map: import('leaflet').Map | undefined;
		let resizeObserver: ResizeObserver | undefined;

		const initializeMap = async () => {
			const L = await import('leaflet');

			map = L.map(mapElement, {
				scrollWheelZoom: false
			}).setView([latitude, longitude], 15);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
			}).addTo(map);

			const markerIcon = L.divIcon({
				className: '',
				html: `
				<div class="femape-map-marker">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
						<circle cx="12" cy="10" r="3" />
					</svg>
				</div>
			`,
				iconSize: [44, 44],
				iconAnchor: [22, 44],
				popupAnchor: [0, -44]
			});

			L.marker([latitude, longitude], {
				icon: markerIcon
			}).addTo(map).bindPopup(`
				<strong>FEMAPE Initiative</strong><br>
				${m.contact_location_address()}
			`);

			/*
			 * Leaflet doit recalculer sa taille lorsque son conteneur
			 * change de dimensions.
			 */
			resizeObserver = new ResizeObserver(() => {
				map?.invalidateSize();
			});

			resizeObserver.observe(mapElement);

			/*
			 * Premier recalcul après le rendu complet du composant.
			 */
			setTimeout(() => {
				map?.invalidateSize();
			}, 0);
		};

		initializeMap();

		return () => {
			resizeObserver?.disconnect();
			map?.remove();
		};
	});
</script>

<section
	class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 md:p-8"
	aria-labelledby="contact-location-title"
>
	<!-- Titre -->
	<header class="mb-6">
		<h2 id="contact-location-title" class="text-2xl font-bold text-primary md:text-3xl">
			{m.contact_location_title()}
		</h2>

		<div class="mt-3 h-1 w-10 rounded-full bg-red-500" aria-hidden="true"></div>
	</header>

	<!-- Carte -->
	<div
		bind:this={mapElement}
		class="
			h-64 w-full overflow-hidden rounded-xl
			border border-slate-200
			md:h-80
			lg:h-96
		"
		aria-label={m.contact_location_map_label()}
	></div>

	<!-- Informations -->
	<div class="mt-6">
		<h3 class="font-bold text-primary">
			{m.contact_location_organization()}
		</h3>

		<address class="mt-2 text-sm leading-relaxed text-slate-600 not-italic md:text-base">
			{m.contact_location_address()}
		</address>

		<a
			href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`}
			target="_blank"
			rel="noopener noreferrer"
			class="
				mt-3 inline-flex items-center gap-1
				font-semibold text-primary
				transition-colors hover:text-blue-700 hover:underline
			"
		>
			{m.contact_location_open_map()}

			<span aria-hidden="true">→</span>
		</a>
	</div>
</section>

<style>
	:global(.leaflet-container) {
		font-family: inherit;
	}

	:global(.femape-map-marker) {
		display: flex;
		width: 44px;
		height: 44px;
		align-items: center;
		justify-content: center;
		border: 4px solid white;
		border-radius: 9999px;
		background: #ef4444;
		color: white;
		box-shadow: 0 3px 8px rgb(0 0 0 / 25%);
	}
</style>
