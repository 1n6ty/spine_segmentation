<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { project } from '$lib/core/project.svelte';
	import DicomUploadCard from '$lib/components/ui/dicom-upload-card/DicomUploadCard.svelte';
	import Nav from '$lib/components/ui/Nav.svelte';
	import Manager from '$lib/components/ui/sessions/Manager.svelte';

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

<div class="space-y-6">
	<Manager />
	<DicomUploadCard />
	<div class="flex w-full flex-col gap-2">
		<Nav />
		<div class="mt-6 flex-1 outline-none">
			{@render children()}
		</div>
	</div>
</div>
