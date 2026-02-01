<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';

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
	{@render children()}
	<Footer />
{:else}
	<p>Loading...</p>
{/if}
