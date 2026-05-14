<script lang="ts">
	import Header from '$lib/components/layout/Header.svelte';
	import Footer from '$lib/components/layout/Footer.svelte';
	import DicomUploadCard from '$lib/components/ui/DicomUploadCard/DicomUploadCard.svelte';
	import Nav from '$lib/components/ui/Nav.svelte';
	import Manager from '$lib/components/ui/Sessions/Manager.svelte';

	let { children } = $props();

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