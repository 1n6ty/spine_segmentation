<script lang="ts">
	import { i18nReady } from '$lib/i18n/index.js';
	import { locale } from 'svelte-i18n';
	import { onMount } from 'svelte';

	import { patientAndStudyExistsInStore } from '$lib/utils/patient.js';

	import './layout.css';
	import favicon from '$lib/assets/icons/favicon.svg';

	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import DicomUploadCard from '$lib/components/ui/DicomUploadCard/DicomUploadCard.svelte';
	import Nav from '$lib/components/ui/Nav.svelte';

	import { cacheLoaded } from '$lib/stores/dicom/dicom.store';

	let ready = $state(false);
	let { children, data } = $props();

	onMount(async () => {
		await i18nReady;
		ready = true;
	});

	$effect(() => {
		if (data?.lang) {
			locale.set(data.lang);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if ready && $cacheLoaded}
	<Header />
	<main class="container mx-auto px-4 py-6">
		<div class="space-y-6">
			<DicomUploadCard />
			<div class="flex flex-col gap-2 w-full">
				{#if $patientAndStudyExistsInStore}
					<Nav />
				{/if}
				<div class="flex-1 outline-none mt-6">
					{@render children()}
				</div>
			</div>
		</div>
	</main>
	<Footer />
{:else}
	<div class="fixed inset-0 bg-(--background)/80 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="loader bg-cover bg-center w-16 h-16"></div>
	</div>
{/if}


<style>
  .loader {
    background-image: url('$lib/assets/icons/loader.svg');
    animation: spin-scale 2s linear infinite;
  }
</style>