<script lang="ts">
	import { i18nState, set_locale } from '$lib/core/i18n/index.svelte.js';
	import type { UrlLang } from '$lib/core/i18n/url-lang';

	import './layout.css';
	import favicon from '$lib/assets/icons/favicon.svg';
	import Spinner from '$lib/components/ui/spinner/Spinner.svelte';

	let { children, data } = $props();

	$effect(() => {
		// data.lang is validated against supportedUrlLangs in +layout.ts's load
		// (which redirects otherwise) — guaranteed a real UrlLang by the time
		// this component ever renders.
		if (data?.lang) {
			set_locale(data.lang as UrlLang);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if i18nState.i18nReady}
	{@render children()}
{:else}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-(--background)/80 backdrop-blur-sm"
	>
		<Spinner size="lg" />
	</div>
{/if}
