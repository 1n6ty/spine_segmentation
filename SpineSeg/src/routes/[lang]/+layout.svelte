<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import DicomUploadCard from '$lib/components/ui/DicomUploadCard.svelte';
	import Nav from '$lib/components/ui/Nav.svelte';

	import { i18nReady } from '$lib/i18n';
	let ready = $state(false);
	i18nReady.then(() => ready = true);

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if ready}
	<Header />
	<main class="container mx-auto px-4 py-6">
		<div class="space-y-6">
			<DicomUploadCard />
			<div class="flex flex-col gap-2 w-full">
				<Nav />
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
    background-image: url('$lib/assets/loader.png');
    animation: spin-scale 2s linear infinite;
  }

  @keyframes spin-scale {
    0% {
      transform: rotate(0deg) scale(1);
    }
    100% {
      transform: rotate(360deg) scale(1);
    }
  }
</style>