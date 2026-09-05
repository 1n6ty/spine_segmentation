<script lang="ts">
	import { t } from 'svelte-i18n';
	import { project } from '$lib/core/project.svelte';
	import LoadingOverlay from '$lib/components/ui/LoadingOverlay.svelte';

	// Wraps a research sub-page's body. While the current session's
	// restoreFromServer round trip is in flight, show a page-wide overlay; once
	// it settles (either way) render the page. Error handling / redirect already
	// lives in researches/[research_id]/+layout.svelte's loadingPromise.catch --
	// the {:catch} here only stops the {#await} from surfacing an unhandled
	// rejection, and still renders children so that redirect is what's visible.
	let { children } = $props();
</script>

{#await project.session.loadingPromise}
	<LoadingOverlay label={$t('research.loading')} />
{:then}
	{@render children()}
{:catch}
	{@render children()}
{/await}
