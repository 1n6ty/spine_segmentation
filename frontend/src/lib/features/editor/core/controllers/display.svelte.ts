import type { InstanceContainer } from '../instance-container.svelte';

/** Screen-space box the VOI pad's own canvas is measured against for a pointer event -- just the
 * bit of `getBoundingClientRect()` this controller actually needs, so tests can pass a plain
 * object instead of a real DOMRect. */
export interface VoiPadBounds {
	left: number;
	top: number;
	width: number;
	height: number;
}

/** Window width never collapses to (or below) zero -- that would divide-by-zero the per-pixel
 * windowing ramp in `render_windowed_bitmap`. */
const MIN_WINDOW_WIDTH = 1;

/** Fraction of the full 0..1 brightness/contrast range one arrow-key press moves by. */
const KEYBOARD_STEP = 0.02;

function clamp01(v: number): number {
	return Math.max(0, Math.min(1, v));
}

/**
 * Owns the two per-projection "view" adjustments that don't affect the underlying data, only how
 * it's displayed: the drawings' overlay opacity, and a live brightness/contrast (DICOM VOI window
 * center/width, under the hood) override for the image itself. Lives alongside
 * `ViewportController`/`ToolController` in `InstanceContainer`, one instance per projection card.
 */
export class DisplayController {
	overlayOpacity = $state(1);

	/** Whether `ViewSettingsPanel`'s collapsible section is open -- lives here (not as local
	 * component state) so it, too, survives `EditorCanvas.svelte` remounting on a tab switch. */
	panelExpanded = $state(false);

	/** Live override for window center/width. `null` means "use the sop-instance's own original
	 * window" -- i.e. nothing has been dragged yet, so the image keeps rendering exactly as it
	 * first loaded, with no extra `rewindow()` call. */
	windowCenter = $state<number | null>(null);
	windowWidth = $state<number | null>(null);

	isDragging = $state(false);
	private rafPending = false;

	constructor(private parent: InstanceContainer) {}

	private get sopInstance() {
		return this.parent.session.projections[this.parent.projection].patient?.study.series
			.sopInstance;
	}

	/** The underlying DICOM window this display currently renders at -- the live override if the
	 * user has dragged, else the image's original window. Internal representation; the UI-facing
	 * values are `brightnessFraction`/`contrastFraction` below. */
	displayCenter = $derived(this.windowCenter ?? this.sopInstance?.originalWindowCenter ?? 0);
	displayWidth = $derived(this.windowWidth ?? this.sopInstance?.originalWindowWidth ?? 0);

	/**
	 * Brightness/contrast, as 0..1 fractions -- a friendlier view over the same window
	 * center/width, oriented so "more" always looks like "more" on screen:
	 * - Brightness is the INVERSE of window center: for fixed pixel data, a LOWER center means
	 *   more of the data range renders as white, i.e. a brighter image. 1 = brightest
	 *   (center = dataMin), 0 = darkest (center = dataMax).
	 * - Contrast is the INVERSE of window width: a NARROWER window is a steeper black-to-white
	 *   ramp, i.e. more contrast. 1 = most contrast (width = the minimum), 0 = least (width =
	 *   double the data range).
	 */
	brightnessFraction = $derived.by((): number => {
		const sop = this.sopInstance;
		if (!sop || sop.dataMin === null || sop.dataMax === null) return 0.5;
		const range = Math.max(sop.dataMax - sop.dataMin, MIN_WINDOW_WIDTH);
		return clamp01((sop.dataMax - this.displayCenter) / range);
	});

	contrastFraction = $derived.by((): number => {
		const sop = this.sopInstance;
		if (!sop || sop.dataMin === null || sop.dataMax === null) return 0.5;
		const range = Math.max(sop.dataMax - sop.dataMin, MIN_WINDOW_WIDTH);
		return clamp01(1 - (this.displayWidth - MIN_WINDOW_WIDTH) / (range * 2));
	});

	/** Current pad crosshair position as a 0..1 fraction of the pad's width/height, for drawing.
	 * X: brightness, left-to-right (right = brighter). Y: contrast, top-to-bottom (top = more
	 * contrast) -- inverted from `contrastFraction` since screen Y grows downward. */
	padFraction = $derived.by((): { tx: number; ty: number } => ({
		tx: this.brightnessFraction,
		ty: 1 - this.contrastFraction
	}));

	setOpacity(v: number) {
		this.overlayOpacity = clamp01(v);
	}

	beginWindowDrag(e: PointerEvent, bounds: VoiPadBounds) {
		this.isDragging = true;
		if (e.target instanceof Element) e.target.setPointerCapture(e.pointerId);
		this.applyPointerToWindow(e, bounds);
	}

	updateWindowDrag(e: PointerEvent, bounds: VoiPadBounds) {
		if (!this.isDragging) return;
		this.applyPointerToWindow(e, bounds);
	}

	endWindowDrag(e: PointerEvent) {
		this.isDragging = false;
		if (e.target instanceof Element) e.target.releasePointerCapture(e.pointerId);
		// Final precise recompute, unthrottled -- the rAF gate below may have skipped some
		// intermediate pointermoves during the drag.
		this.commitWindow();
	}

	resetWindow() {
		this.windowCenter = null;
		this.windowWidth = null;
		this.commitWindow();
	}

	/** Nudges brightness by one keyboard step (e.g. the pad's ArrowRight/ArrowLeft handler).
	 * `direction`: +1 brighter, -1 darker. */
	nudgeBrightness(direction: 1 | -1) {
		this.setFractions(this.brightnessFraction + direction * KEYBOARD_STEP, this.contrastFraction);
		this.throttledCommit();
	}

	/** Nudges contrast by one keyboard step (e.g. the pad's ArrowUp/ArrowDown handler).
	 * `direction`: +1 more contrast, -1 less. */
	nudgeContrast(direction: 1 | -1) {
		this.setFractions(this.brightnessFraction, this.contrastFraction + direction * KEYBOARD_STEP);
		this.throttledCommit();
	}

	private applyPointerToWindow(e: PointerEvent, bounds: VoiPadBounds) {
		if (bounds.width <= 0 || bounds.height <= 0) return;

		const tx = clamp01((e.clientX - bounds.left) / bounds.width);
		const ty = clamp01((e.clientY - bounds.top) / bounds.height);

		// tx is brightness directly (right = brighter); ty is INVERTED contrast (top = more
		// contrast, but screen Y grows downward) -- same orientation as `padFraction`.
		this.setFractions(tx, 1 - ty);
		this.throttledCommit();
	}

	/** Sets brightness/contrast from 0..1 fractions (same orientation as `padFraction`) and
	 * resolves them into the underlying window center/width. Shared by pointer-drag
	 * (`applyPointerToWindow`) and keyboard nudging (`nudgeBrightness`/`nudgeContrast`) so both
	 * stay in exact agreement about what a given fraction means. */
	private setFractions(brightness: number, contrast: number) {
		const sop = this.sopInstance;
		if (!sop || sop.dataMin === null || sop.dataMax === null) return;

		const range = Math.max(sop.dataMax - sop.dataMin, MIN_WINDOW_WIDTH);
		// brightness=0 -> darkest (center = dataMax); brightness=1 -> brightest (center = dataMin).
		this.windowCenter = sop.dataMax - clamp01(brightness) * range;
		// contrast=1 -> most contrast (width = MIN); contrast=0 -> least (width = 2*range).
		this.windowWidth = MIN_WINDOW_WIDTH + (1 - clamp01(contrast)) * range * 2;
	}

	/** Recomputing the bitmap is an O(rows*cols) per-pixel loop -- too slow to run unthrottled on
	 * every pointermove, so at most one commit runs per animation frame during a drag. */
	private throttledCommit() {
		if (this.rafPending) return;
		this.rafPending = true;
		requestAnimationFrame(() => {
			this.rafPending = false;
			this.commitWindow();
		});
	}

	private commitWindow() {
		const sop = this.sopInstance;
		if (!sop) return;
		// `windowCenter`/`windowWidth` null (nothing dragged, or just Reset) means "back to
		// original" -- resolve those here rather than baking them into `displayCenter`/
		// `displayWidth` above, since a bare `null` needs to pass straight through to the
		// original values without also being clamped through `padFraction`'s data-range math.
		const center = this.windowCenter ?? sop.originalWindowCenter;
		const width = this.windowWidth ?? sop.originalWindowWidth;
		if (center === null || width === null) return;
		sop.rewindow(center, width);
	}
}
