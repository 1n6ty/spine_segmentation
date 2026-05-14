<script lang="ts">
	import { i18nState } from '$lib/core/i18n/index.svelte.js';
	import { locale } from 'svelte-i18n';

	import './layout.css';
	import favicon from '$lib/assets/icons/favicon.svg';

	import { registry } from '$lib/core/session/registry.svelte';

	let { children, data } = $props();

	$effect(() => {
		if (data?.lang) {
			locale.set(data.lang);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if i18nState.i18nReady && registry.ready}
	{@render children()}
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