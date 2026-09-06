<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { project } from '$lib/core/project.svelte';

	let { children } = $props();

	// Runs after (authenticated)/+layout.svelte's own onMount has resolved
	// project.auth.verify() -- that parent layout only mounts this one's
	// content once `checked && status === 'authenticated'`, so
	// authService.permissions is already populated here.
	onMount(() => {
		if (!project.hasPermission('Dicom.access_studies')) {
			goto(`/${page.params.lang}`);
		}
	});
</script>

{@render children()}
