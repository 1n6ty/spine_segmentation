<script lang="ts">
    import { t } from "svelte-i18n";

    import favicon from '$lib/assets/icons/favicon.svg';

    import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import DicomUploadCard from '$lib/components/ui/DicomUploadCard/DicomUploadCard.svelte';
	import Nav from '$lib/components/ui/Nav.svelte';
    import KeyFeatures from "$lib/components/layout/KeyFeatures/KeyFeatures.svelte";
	import { project } from "$lib/core/project.svelte";
	import Manager from "$lib/components/ui/Sessions/Manager.svelte";
</script>

<Header />
<main class="container mx-auto px-4 py-6">
    <div class="space-y-6">
        <Manager />
        <DicomUploadCard />
        <div class="flex flex-col gap-2 w-full">
            {#if (project.session.projections.side.patient || project.session.projections.frontal.patient)}
                <Nav />
            {/if}
            <div class="flex-1 outline-none mt-6">
                <div class="text-center py-16">
                    <img src={ favicon } alt="favicon" class="w-16 h-16 mx-auto mb-4 text-(--muted-foreground)"/>
                    <h2 class="text-2xl font-semibold mb-2">{ $t('main.welcome_h2') }</h2>
                    <p class="text-(--muted-foreground) mb-6 max-w-md mx-auto">{ $t('main.p') }</p>
                    <div class="max-w-2xl mx-auto bg-(--muted) p-6 rounded-lg text-left">
                        <h3 class="font-semibold mb-3">{ $t('main.key_features.h3') }</h3>
                        <KeyFeatures />
                    </div>
                </div>
            </div>
        </div>
    </div>
</main>
<Footer />
