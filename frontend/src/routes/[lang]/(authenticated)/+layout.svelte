<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { project } from '$lib/core/project.svelte';
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import DicomUploadCard from '$lib/components/ui/dicom-upload-card/DicomUploadCard.svelte';
	import Nav from '$lib/components/ui/Nav.svelte';
	import Manager from '$lib/components/ui/sessions/Manager.svelte';

	let { children } = $props();

	/**
	 * Client-side-only guard, deliberately NOT a `+layout.server.ts` load function:
	 * this app is built with `adapter-static` + SPA `fallback: 'index.html'`, so there
	 * is no server running at request time in production to check a live session
	 * against. This is still not the real security boundary — actual enforcement
	 * happens server-side when an API/WebSocket call gets rejected — but unlike a
	 * localStorage flag, `authService.verify()` calls `GET /api/me/` and only grants
	 * access once the backend confirms the session cookie is still live, so a
	 * deleted/expired cookie can no longer leave stale protected content on screen.
	 *
	 * Rendering is gated on `checked` so protected content (patient sessions, the
	 * DICOM upload card) never mounts even briefly before the redirect fires.
	 */
	let checked = $state(false);

	onMount(async () => {
		const ok = await project.auth.verify();
		checked = true;
		if (!ok) {
			goto(`/${page.params.lang}/login`);
		}
	});
</script>

{#if checked && project.auth.status === 'authenticated'}
	<Header />
	<main class="container mx-auto px-4 py-6">
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
	</main>
	<Footer />
{/if}
