<script lang="ts">
	import { onMount } from 'svelte';
	import type { SegmentRangePicker } from '$lib/features/medical-parameters/segment-range-picker.svelte';
	import {
		computeFitTransform,
		drawSegmentRangePicker,
		type View
	} from '$lib/features/medical-parameters/segment-range-render';
	import { screen_to_world } from '$lib/shared/geometry/geometry';
	import type { Point } from '$lib/shared/geometry/geometry.type';

	let { picker }: { picker: SegmentRangePicker } = $props();

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let canvasSize = $state({ width: 0, height: 0 });
	let view: View = { offset: { x: 0, y: 0 }, scale: 1 };

	onMount(() => {
		if (!canvas) return;
		const resizeObserver = new ResizeObserver(() => {
			canvasSize = { width: canvas!.clientWidth, height: canvas!.clientHeight };
		});
		resizeObserver.observe(canvas);
		return () => resizeObserver.disconnect();
	});

	$effect(() => {
		if (!canvas) return;
		// Re-run on picker's own reactive state too (selection, drag) -- reading
		// `canvasSize` alongside is what re-triggers on resize.
		void canvasSize;
		void picker.superiorIndex;
		void picker.inferiorIndex;
		void picker.centralPath;

		canvas.width = canvasSize.width || canvas.clientWidth;
		canvas.height = canvasSize.height || canvas.clientHeight;

		view = computeFitTransform(picker.polygons, canvas.width, canvas.height);

		const ctx = canvas.getContext('2d');
		if (ctx) drawSegmentRangePicker(ctx, picker, view);
	});

	function world_point(e: PointerEvent | MouseEvent): Point {
		const rect = canvas!.getBoundingClientRect();
		return screen_to_world(
			{ x: e.clientX - rect.left, y: e.clientY - rect.top },
			view.offset,
			view.scale
		);
	}

	// The browser fires a synthetic `click` right after `pointerup` on the same element
	// (pointer capture keeps the target the canvas throughout the drag) -- by then
	// `picker.isDragging`/`isDraggingBody` have already gone back to false (`endDragHandle`/
	// `endDragBody` cleared them in `onpointerup`, which always runs first), so `onclick`
	// couldn't tell a genuine click apart from the tail end of a drag. Tracked separately so
	// `onclick` can suppress exactly that one synthetic event.
	let justFinishedDrag = false;

	function onpointerdown(e: PointerEvent) {
		const handle = picker.hitTestHandle(world_point(e), view.scale);
		if (handle) {
			picker.beginDragHandle(e, handle);
			return;
		}

		// Shift+click keeps its own extend-from-anchor meaning (`onclick` below) -- arming a
		// body-drag here would reset the anchor to this vertebra before that logic ever runs.
		if (e.shiftKey) return;

		if (picker.polygons.length === 0) return;
		picker.beginDragBody(e, picker.nearestVertebraIndex(world_point(e)));
	}
	function onpointermove(e: PointerEvent) {
		if (picker.isDragging) {
			picker.updateDragHandle(world_point(e));
		} else if (picker.isDraggingBody) {
			picker.updateDragBody(world_point(e));
		}
	}
	function onpointerup(e: PointerEvent) {
		if (picker.isDragging) {
			justFinishedDrag = true;
			picker.endDragHandle(e);
		} else if (picker.isDraggingBody) {
			justFinishedDrag = true;
			picker.endDragBody(e);
		}
	}
	function onclick(e: MouseEvent) {
		if (justFinishedDrag) {
			justFinishedDrag = false;
			return;
		}
		// Reached only for clicks that never armed a body-drag on pointerdown: Shift+click
		// (skipped above on purpose). A plain, non-Shift click already resolved via
		// `beginDragBody`/`endDragBody` and is suppressed above.
		if (picker.polygons.length === 0) return;
		picker.selectVertebra(picker.nearestVertebraIndex(world_point(e)), e.shiftKey);
	}
</script>

<canvas
	bind:this={canvas}
	class="h-full w-full touch-none"
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	{onclick}
></canvas>
