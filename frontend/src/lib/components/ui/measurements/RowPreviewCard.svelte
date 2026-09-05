<script lang="ts">
	import { t } from 'svelte-i18n';
	import { project } from '$lib/core/project.svelte';
	import type { Projection } from '$lib/features/dicom/types';
	import type { Polygon } from '$lib/shared/geometry/geometry.type';
	import {
		computeRegionFitTransform,
		drawRegionPreview,
		drawGridOverlay,
		mmPerGridSquare
	} from '$lib/features/medical-parameters/row-preview-render';

	/**
	 * Floating, calibrated crop preview for a hovered Measurement Table row -- renders its own
	 * small canvas straight from the projection's DICOM bitmap (the /measure route never mounts
	 * the editor, so there's no on-screen image to point at), zoomed to the row's own polygon(s)
	 * plus proportional padding for context, with a screen-space grid and a live mm/square
	 * legend computed from the current crop's scale.
	 */
	let {
		projection,
		polygons,
		anchorRect
	}: {
		projection: Projection;
		polygons: Polygon[];
		anchorRect: DOMRect;
	} = $props();

	const CARD_WIDTH = 300;
	const CARD_HEIGHT = 200;
	const GAP = 12;
	const VIEWPORT_MARGIN = 8;
	const GRID_SPACING_PX = 32;

	let bitmap = $derived(
		project.session.projections[projection].patient?.study.series.sopInstance.bitmap ?? null
	);
	let mmPerPixel = $derived(
		project.session.projections[projection].patient?.study.series.sopInstance.mmPerPixel || 1
	);

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	// A pure `$derived` of `polygons` (the canvas is always CARD_WIDTH x CARD_HEIGHT, so
	// those don't need to be read reactively) -- NOT a `$state` written from inside the
	// drawing `$effect` below. An effect that both reads and writes the same `$state`
	// value creates a self-triggering update loop (Svelte throws
	// `effect_update_depth_exceeded` once it hits the safety limit), which then breaks
	// reactivity for the rest of the component tree, including the parent's `hoveredRow`
	// toggle that's supposed to unmount this card on mouseleave.
	let view = $derived(computeRegionFitTransform(polygons, CARD_WIDTH, CARD_HEIGHT));

	$effect(() => {
		const currentBitmap = bitmap;
		if (!canvas || !currentBitmap) return;

		canvas.width = CARD_WIDTH;
		canvas.height = CARD_HEIGHT;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		drawRegionPreview(ctx, currentBitmap, view, polygons);
		drawGridOverlay(ctx, canvas.width, canvas.height, GRID_SPACING_PX);
	});

	let legendMm = $derived(mmPerGridSquare(view, mmPerPixel, GRID_SPACING_PX));

	let style = $derived.by(() => {
		// Stacked above/below the row (never beside it) so the card can't cover that row's
		// own cell values -- prefer above (typical tooltip placement), drop below only when
		// there isn't room above.
		let top = anchorRect.top - GAP - CARD_HEIGHT;
		if (top < VIEWPORT_MARGIN) {
			top = anchorRect.bottom + GAP;
		}
		top = Math.min(
			Math.max(top, VIEWPORT_MARGIN),
			Math.max(window.innerHeight - CARD_HEIGHT - VIEWPORT_MARGIN, VIEWPORT_MARGIN)
		);

		let left = anchorRect.left;
		left = Math.min(
			Math.max(left, VIEWPORT_MARGIN),
			Math.max(window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN, VIEWPORT_MARGIN)
		);

		return `left: ${left}px; top: ${top}px;`;
	});
</script>

<div
	class="pointer-events-none fixed z-50 rounded-xl border border-(--border) bg-(--card) p-1.5 shadow-lg"
	{style}
>
	<div
		class="relative overflow-hidden rounded-md"
		style="width: {CARD_WIDTH}px; height: {CARD_HEIGHT}px;"
	>
		<canvas bind:this={canvas} class="h-full w-full"></canvas>
		<span
			class="absolute top-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
			>{legendMm.toFixed(1)} {$t('units.linear')} / sq</span
		>
	</div>
</div>
