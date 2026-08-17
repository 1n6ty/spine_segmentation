<script lang="ts">
	import { onMount } from 'svelte';
	import { project } from '$lib/core/project.svelte';

	let { children } = $props();

	// This route names no research_id (unlike researches/[research_id]/+layout.svelte,
	// which syncs project.session FROM the URL) -- mounting it deselects
	// whatever research was previously active in-app. See Project.enterBareRoute().
	onMount(() => {
		project.enterBareRoute();
	});
</script>

{@render children()}
