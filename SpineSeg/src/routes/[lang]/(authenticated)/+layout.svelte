<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { locale } from 'svelte-i18n';

	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import DicomUploadCard from '$lib/components/ui/DicomUploadCard/DicomUploadCard.svelte';
	import Nav from '$lib/components/ui/Nav.svelte';
	import Manager from '$lib/components/ui/Sessions/Manager.svelte';

	let { children } = $props();

	/**
	 * Client-side-only guard, deliberately NOT a `+layout.server.ts` load function:
	 * this app is built with `adapter-static` + SPA `fallback: 'index.html'`, so there
	 * is no server running at request time in production to check a live session
	 * against. This is a UX redirect only, not the real security boundary — the
	 * `sessionid` cookie's mere presence is a heuristic (it could be stale/expired);
	 * actual enforcement happens server-side when an API/WebSocket call gets rejected,
	 * which should itself redirect back here on a 401/403.
	 *
	 * Note: the backend sets `SESSION_COOKIE_SECURE = True` unconditionally, so this
	 * cookie is only ever set/sent over HTTPS — over plain HTTP (e.g. local dev without
	 * a TLS-terminating proxy in front), login will appear to succeed but no cookie is
	 * ever stored, and this guard will keep redirecting to login. See docs/doctor-profile.md.
	 *
	 * Checks a `hasSession` localStorage flag, not the real `sessionid` cookie directly —
	 * Django sets that cookie `HttpOnly` (a real security default, not something to weaken
	 * just for this heuristic), so `document.cookie` can never see it. The login/logout
	 * flows set/clear this flag alongside the real session.
	 */
	onMount(() => {
		const hasSession = localStorage.getItem('hasSession') === '1';
		if (!hasSession) {
			goto(`/${$locale}/login`);
		}
	});
</script>

<Header />
<main class="container mx-auto px-4 py-6">
    <div class="space-y-6">
        <Manager />
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