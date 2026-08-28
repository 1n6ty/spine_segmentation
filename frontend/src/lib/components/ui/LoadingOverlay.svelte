<script lang="ts">
	import Spinner from '$lib/components/ui/spinner/Spinner.svelte';

	// Page-wide blurred overlay -- `fixed inset-0` so it covers the viewport no
	// matter which component mounts it. Mirrors the editor autofill overlay
	// (EditorCanvas.svelte) / ConfirmCard.svelte visual.
	let { label }: { label?: string } = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-(--background)/60 backdrop-blur-sm"
>
	<Spinner size="lg" {label} />
</div>
