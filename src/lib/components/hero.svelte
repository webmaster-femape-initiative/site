<script lang="ts">
	import heroMobile from '$lib/assets/background-hero-sm.png';
	import heroMd from '$lib/assets/background-hero-md.png';
	import heroLg from '$lib/assets/background-hero-lg.png';
	import heroXl from '$lib/assets/background-hero-xl.png';
	import hero3Xl from '$lib/assets/background-hero-3xl.png';

	import { m } from '$lib/paraglide/messages.js';
</script>

<section
	class="
	grid
	h-95
    grid-rows-[2fr_1fr]
    bg-(image:--hero-mobile)
	bg-cover
    bg-bottom
 


    sm:h-105
    sm:bg-center
    md:h-100
    md:bg-(image:--hero-md)
    lg:h-95


    lg:bg-(image:--hero-lg)
    xl:h-100
    xl:bg-(image:--hero-xl)
    2xl:h-145
    2xl:bg-position-[center_70%]
    3xl:h-180

    3xl:bg-(image:--hero-3xl)

  "
	style="
    --hero-mobile: url('{heroMobile}');
    --hero-md: url('{heroMd}');
    --hero-lg: url('{heroLg}');
    --hero-xl: url('{heroXl}');
    --hero-3xl: url('{hero3Xl}');
  "
>
	<!-- Définitions SVG : uniquement ce que Tailwind ne sait pas faire proprement -->
	<svg class="absolute h-0 w-0" width="0" height="0" aria-hidden="true">
		<defs>
			<clipPath id="brush-blue" clipPathUnits="objectBoundingBox">
				<!-- Trait supérieur : plus court à gauche, plus long à droite -->
				<path
					d="
      M 0.035 0.14

      C 0.070 0.10, 0.105 0.13, 0.135 0.09
      C 0.220 0.055, 0.335 0.075, 0.450 0.055
      C 0.585 0.035, 0.720 0.055, 0.835 0.045
      C 0.885 0.045, 0.925 0.060, 0.958 0.085

      Q 0.968 0.100, 0.958 0.116
      Q 0.974 0.130, 0.961 0.145
      Q 0.978 0.160, 0.963 0.176
      Q 0.980 0.192, 0.965 0.208
      Q 0.981 0.224, 0.965 0.240
      Q 0.979 0.256, 0.963 0.272
      Q 0.977 0.288, 0.961 0.304
      Q 0.974 0.320, 0.959 0.336
      Q 0.970 0.352, 0.958 0.390

      C 0.825 0.405, 0.690 0.390, 0.555 0.415
      C 0.405 0.435, 0.260 0.410, 0.125 0.445

      Q 0.055 0.438, 0.048 0.420
      Q 0.038 0.405, 0.050 0.390
      Q 0.037 0.375, 0.049 0.360
      Q 0.036 0.345, 0.048 0.330
      Q 0.035 0.315, 0.047 0.300
      Q 0.035 0.285, 0.047 0.270
      Q 0.035 0.255, 0.046 0.240
      Q 0.036 0.225, 0.046 0.210
      Q 0.037 0.195, 0.046 0.180
      Q 0.040 0.158, 0.035 0.140

      Z
    "
				/>

				<!-- Trait inférieur : légèrement plus long à gauche, plus court à droite -->
				<path
					d="
      M 0.020 0.42

      C 0.085 0.390, 0.215 0.410, 0.340 0.385
      C 0.485 0.365, 0.625 0.390, 0.760 0.365
      C 0.840 0.355, 0.895 0.365, 0.940 0.390

      Q 0.950 0.405, 0.940 0.420
      Q 0.953 0.435, 0.941 0.450
      Q 0.955 0.465, 0.942 0.480
      Q 0.956 0.495, 0.943 0.510
      Q 0.957 0.525, 0.943 0.540
      Q 0.956 0.555, 0.942 0.570
      Q 0.955 0.585, 0.941 0.600
      Q 0.953 0.615, 0.940 0.630
      Q 0.952 0.645, 0.939 0.660
      Q 0.950 0.675, 0.938 0.690
      Q 0.947 0.710, 0.935 0.745

      C 0.795 0.785, 0.650 0.770, 0.510 0.805
      C 0.365 0.830, 0.220 0.805, 0.090 0.850

      Q 0.032 0.845, 0.024 0.825
      Q 0.014 0.810, 0.024 0.795
      Q 0.012 0.780, 0.023 0.765
      Q 0.011 0.750, 0.022 0.735
      Q 0.010 0.720, 0.022 0.705
      Q 0.010 0.690, 0.021 0.675
      Q 0.009 0.660, 0.021 0.645
      Q 0.009 0.630, 0.021 0.615
      Q 0.010 0.600, 0.022 0.585
      Q 0.010 0.570, 0.022 0.555
      Q 0.011 0.540, 0.023 0.525
      Q 0.012 0.510, 0.024 0.495
      Q 0.014 0.475, 0.020 0.420

      Z
    "
				/>
			</clipPath>

			<clipPath id="brush-red" clipPathUnits="objectBoundingBox">
				<!-- Trait supérieur : plus court à gauche, plus long à droite -->
				<path
					d="
      M 0.035 0.13

      C 0.090 0.090, 0.190 0.110, 0.300 0.075
      C 0.440 0.055, 0.585 0.080, 0.720 0.055
      C 0.820 0.045, 0.895 0.060, 0.958 0.090

      Q 0.969 0.105, 0.959 0.120
      Q 0.975 0.135, 0.962 0.150
      Q 0.978 0.165, 0.964 0.180
      Q 0.980 0.195, 0.965 0.210
      Q 0.981 0.225, 0.965 0.240
      Q 0.980 0.255, 0.964 0.270
      Q 0.978 0.285, 0.963 0.300
      Q 0.976 0.315, 0.961 0.330
      Q 0.973 0.345, 0.960 0.360
      Q 0.970 0.375, 0.958 0.400

      C 0.830 0.420, 0.690 0.400, 0.555 0.430
      C 0.405 0.450, 0.265 0.425, 0.125 0.455

      Q 0.055 0.445, 0.048 0.430
      Q 0.038 0.415, 0.050 0.400
      Q 0.037 0.385, 0.049 0.370
      Q 0.036 0.355, 0.048 0.340
      Q 0.035 0.325, 0.047 0.310
      Q 0.035 0.295, 0.047 0.280
      Q 0.035 0.265, 0.046 0.250
      Q 0.036 0.235, 0.046 0.220
      Q 0.037 0.205, 0.046 0.190
      Q 0.040 0.155, 0.035 0.130

      Z
    "
				/>

				<!-- Trait inférieur : légèrement plus long à gauche, plus court à droite -->
				<path
					d="
      M 0.020 0.425

      C 0.090 0.395, 0.245 0.415, 0.385 0.390
      C 0.525 0.370, 0.665 0.395, 0.790 0.370
      C 0.860 0.365, 0.905 0.375, 0.940 0.400

      Q 0.950 0.415, 0.940 0.430
      Q 0.953 0.445, 0.941 0.460
      Q 0.955 0.475, 0.942 0.490
      Q 0.956 0.505, 0.943 0.520
      Q 0.957 0.535, 0.943 0.550
      Q 0.956 0.565, 0.942 0.580
      Q 0.955 0.595, 0.941 0.610
      Q 0.953 0.625, 0.940 0.640
      Q 0.952 0.655, 0.939 0.670
      Q 0.950 0.685, 0.938 0.700
      Q 0.947 0.720, 0.935 0.755

      C 0.780 0.800, 0.635 0.780, 0.495 0.815
      C 0.350 0.840, 0.205 0.815, 0.085 0.855

      Q 0.032 0.845, 0.024 0.830
      Q 0.014 0.815, 0.024 0.800
      Q 0.012 0.785, 0.023 0.770
      Q 0.011 0.755, 0.022 0.740
      Q 0.010 0.725, 0.022 0.710
      Q 0.010 0.695, 0.021 0.680
      Q 0.009 0.665, 0.021 0.650
      Q 0.009 0.635, 0.021 0.620
      Q 0.010 0.605, 0.022 0.590
      Q 0.010 0.575, 0.022 0.560
      Q 0.011 0.545, 0.023 0.530
      Q 0.012 0.515, 0.024 0.500
      Q 0.014 0.480, 0.020 0.425

      Z
    "
				/>
			</clipPath>
		</defs>
	</svg>
	<!-- 2/3 supérieurs -->
	<div class="flex items-center justify-center">
		<h1
			class="
    flex flex-col items-center
    font-['Caveat'] text-[2.7rem]
    leading-[1.05] font-semibold
    text-white
    sm:text-[4em]
    md:text-[5rem]
    lg:text-[6rem]
    2xl:text-[7.5rem]
    3xl:text-[9.5em]
  "
		>
			<!-- Trait bleu -->
			<span
				class="
      brush-blue
      relative z-20
      inline-block translate-x-[-0.12em]
      translate-y-[0.02em]
      rotate-[-2.2deg]
      bg-primary
      px-[0.9em]
      whitespace-nowrap
    "
			>
				<span
					class="
        relative z-10
        inline-block
        pt-[0.06em]
        pb-[0.48em]
      "
				>
					{m.solidarity()} <span class="sm:hidden"><br /></span>{m.here()},
				</span>
			</span>

			<!-- Trait rouge -->
			<span
				class="
      brush-red
      relative z-10
      mt-[-0.12em]
      inline-block translate-x-[0.15em]
      rotate-[-1.8deg]
      bg-secondary
      px-[0.95em]
      whitespace-nowrap
    "
			>
				<span
					class="
        relative z-10
        inline-block
        pt-[0.06em]
        pb-[0.42em]
      "
				>
					{m.commited()} <span class="sm:hidden"><br /></span>{m.elsewhere()}
				</span>
			</span>
		</h1>
	</div>

	<!-- 1/3 inférieur -->
	<div class="flex items-center justify-center">
		<p
			class="
        px-6 text-center
        font-sans text-base text-[1rem]
        font-semibold text-white drop-shadow-lg sm:text-[1.6rem]
      md:text-[1.6rem]
    lg:text-[1.5rem]
    xl:text-[2rem]
    2xl:text-[3rem]
      "
		>
			{m.subslogan()}
		</p>
	</div>
</section>

<style lang="scss">
	.brush-blue {
		clip-path: url('#brush-blue');
	}

	.brush-red {
		clip-path: url('#brush-red');
	}
</style>
