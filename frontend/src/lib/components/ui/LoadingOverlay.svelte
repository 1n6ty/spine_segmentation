<script lang="ts">
	import Spinner from '$lib/components/ui/spinner/Spinner.svelte';

	// Page-wide blurred overlay -- `fixed inset-0` so it covers the viewport no
	// matter which component mounts it. Mirrors the editor autofill overlay
	// (EditorCanvas.svelte) / ConfirmCard.svelte visual. `h-dvh` (dynamic
	// viewport height) is set explicitly alongside `inset-0` -- on mobile
	// browsers whose address bar shows/hides, `inset-0`'s IMPLICIT height
	// (from top:0/bottom:0) can resolve against the larger *layout* viewport
	// instead of the currently-visible *visual* one, leaving an unblurred
	// strip at the bottom once the bar collapses. An explicit `height` wins
	// over that implicit inset-derived one (CSS's over-constrained-box
	// resolution favors an explicit `height`), and is a no-op on desktop
	// where dvh and vh are equal. Deliberately not paired with an equivalent
	// dvh-based width class: that unit is a HEIGHT percentage, so using it
	// for width sizes the box to the viewport's height instead -- narrower
	// than the screen on any wider-than-tall display, leaving it short of
	// the right edge. Width has no mobile-toolbar quirk to begin with, so
	// `inset-0`'s own left:0/right:0 is left to govern it, unmodified.
	let { label }: { label?: string } = $props();
</script>

<div
	class="fixed inset-0 z-50 flex h-dvh items-center justify-center bg-(--background)/60 backdrop-blur-sm"
>
	<Spinner size="lg" {label} />
</div>
