<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';

	import favicon from '$lib/assets/icons/favicon.svg';

	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import DicomUploadCard from '$lib/components/ui/dicom-upload-card/DicomUploadCard.svelte';
	import Nav from '$lib/components/ui/Nav.svelte';
	import KeyFeatures from '$lib/components/sections/key-features/KeyFeatures.svelte';
	import { project } from '$lib/core/project.svelte';
	import Manager from '$lib/components/ui/sessions/Manager.svelte';
	import { authService } from '$lib/core/session/auth.svelte';

	// This landing page is reachable without logging in, so the Researches/
	// DICOM upload cards must only render once the backend actually confirms
	// a live session -- not from a locally-cached "was logged in" flag.
	onMount(() => {
		authService.verify();
	});
</script>

<Header />
<main class="container mx-auto px-4 py-6">
	<div class="space-y-6">
		{#if authService.status === 'authenticated'}
			<Manager />
			<DicomUploadCard />
		{/if}
		<div class="flex w-full flex-col gap-2">
			{#if project.session.projections.side.patient || project.session.projections.frontal.patient}
				<Nav />
			{/if}
			<div class="mt-6 flex-1 outline-none">
				<div class="py-16 text-center">
					<img
						src={favicon}
						alt="favicon"
						class="mx-auto mb-4 h-16 w-16 text-(--muted-foreground)"
					/>
					<h2 class="mb-2 text-2xl font-semibold">{$t('main.welcome_h2')}</h2>
					<p class="mx-auto mb-6 max-w-md text-(--muted-foreground)">{$t('main.p')}</p>
					<div class="mx-auto max-w-2xl rounded-lg bg-(--muted) p-6 text-left">
						<h3 class="mb-3 font-semibold">{$t('main.key_features.h3')}</h3>
						<KeyFeatures />
					</div>
				</div>
			</div>
		</div>
	</div>
</main>
<Footer />
