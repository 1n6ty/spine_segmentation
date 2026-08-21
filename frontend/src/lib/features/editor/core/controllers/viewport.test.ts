import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { InstanceContainer } from '../instance-container.svelte';
import { SessionService } from '$lib/core/session/session.svelte';

class FakeElement {
	setPointerCapture = vi.fn();
	releasePointerCapture = vi.fn();
}

function fake_canvas(
	clientWidth = 800,
	clientHeight = 600,
	// Defaults to matching clientWidth/clientHeight, like the real canvas does once a draw has
	// run -- pass an explicit, different value to simulate the stale backing-store size that
	// exists briefly right after a resize, before the next `drawBackground()` call resyncs it.
	backingWidth = clientWidth,
	backingHeight = clientHeight
) {
	return {
		clientWidth,
		clientHeight,
		width: backingWidth,
		height: backingHeight,
		getBoundingClientRect: () => ({ left: 0, top: 0 })
	} as unknown as HTMLCanvasElement;
}

function fake_pointer_event(overrides: Partial<PointerEvent> = {}) {
	return {
		clientX: 0,
		clientY: 0,
		pointerId: 1,
		target: new FakeElement(),
		...overrides
	} as unknown as PointerEvent;
}

let session: SessionService;
let container: InstanceContainer;

beforeEach(async () => {
	vi.stubGlobal('Element', FakeElement);
	session = new SessionService(null);
	await session.loadingPromise;
	container = new InstanceContainer('side', session);
	container.mainCanvas = fake_canvas();
});

describe('ViewportController dragging', () => {
	it('beginDrag starts a drag and captures the pointer, unconditionally (button/mode-agnostic)', () => {
		const target = new FakeElement();
		container.nav.beginDrag(
			fake_pointer_event({ clientX: 10, clientY: 20, target: target as any })
		);

		expect(container.nav.isDragging).toBe(true);
		expect(target.setPointerCapture).toHaveBeenCalledWith(1);
	});

	it('updateDrag while dragging pans the view by the pointer delta', () => {
		container.nav.beginDrag(fake_pointer_event({ clientX: 10, clientY: 10 }));
		container.nav.updateDrag(fake_pointer_event({ clientX: 25, clientY: 15 }));

		expect(container.nav.view.offset).toEqual({ x: 15, y: 5 });
	});

	it('updateDrag while not dragging is a no-op', () => {
		container.nav.updateDrag(fake_pointer_event({ clientX: 100, clientY: 100 }));
		expect(container.nav.view.offset).toEqual({ x: 0, y: 0 });
	});

	it('endDrag stops dragging and releases pointer capture', () => {
		const target = new FakeElement();
		container.nav.beginDrag(fake_pointer_event({ target: target as any }));

		container.nav.endDrag(fake_pointer_event({ target: target as any }));

		expect(container.nav.isDragging).toBe(false);
		expect(target.releasePointerCapture).toHaveBeenCalled();
	});
});

describe('ViewportController zoom', () => {
	it('zoom() clamps scale between minScale and maxScale', () => {
		container.nav.minScale = 0.5;
		container.nav.maxScale = 2;

		container.nav.zoom(0.01);
		expect(container.nav.view.scale).toBe(0.5);

		container.nav.view.scale = 1;
		container.nav.zoom(100);
		expect(container.nav.view.scale).toBe(2);
	});

	it('zoom() around a focal point keeps that world point under the cursor', () => {
		container.nav.minScale = 0.1;
		container.nav.maxScale = 10;
		container.nav.view = { offset: { x: 0, y: 0 }, scale: 1 };

		container.nav.zoom(2, { x: 100, y: 100 });

		expect(container.nav.view.scale).toBe(2);
		expect(container.nav.view.offset.x).toBe(100 - 100 * 2);
		expect(container.nav.view.offset.y).toBe(100 - 100 * 2);
	});

	it('scalePercentage is 0 until minScale is known', () => {
		expect(container.nav.scalePercentage).toBe(0);
	});

	it('scalePercentage reflects scale relative to minScale', () => {
		container.nav.minScale = 0.5;
		container.nav.view.scale = 1;
		expect(container.nav.scalePercentage).toBe(200);
	});

	it('zoomToCenter zooms around the canvas center', () => {
		container.nav.minScale = 0.1;
		container.nav.maxScale = 10;
		const zoom_spy = vi.spyOn(container.nav, 'zoom');

		const ok = container.nav.zoomToCenter(2);

		expect(ok).toBe(true);
		expect(zoom_spy).toHaveBeenCalledWith(2, { x: 400, y: 300 });
	});

	it('zoomToCenter returns false with no mainCanvas', () => {
		container.mainCanvas = null;
		expect(container.nav.zoomToCenter(2)).toBe(false);
	});
});

describe('ViewportController.zoomToFit', () => {
	it('fits and centers the bitmap, deriving minScale/maxScale from it', () => {
		const bitmap = { width: 1000, height: 500 };
		session.projections.side.patient = {
			study: { series: { sopInstance: { bitmap } } }
		} as any;
		container.mainCanvas = fake_canvas(500, 500);

		container.nav.zoomToFit();

		expect(container.nav.minScale).toBeCloseTo(0.5);
		expect(container.nav.maxScale).toBeCloseTo(8);
		expect(container.nav.view.scale).toBeCloseTo(0.5);
	});

	it('is a no-op with no mainCanvas', () => {
		container.mainCanvas = null;
		expect(() => container.nav.zoomToFit()).not.toThrow();
		expect(container.nav.view.scale).toBe(1);
	});

	it('is a no-op with no bitmap loaded yet', () => {
		expect(() => container.nav.zoomToFit()).not.toThrow();
		expect(container.nav.view.scale).toBe(1);
	});

	it('centers on the LIVE clientWidth/clientHeight, not a stale canvas.width/height left over from before a resize', () => {
		// Regression test: right after a window resize, `mainCanvas.clientWidth/clientHeight`
		// already reflect the new layout size, but `mainCanvas.width/height` (the backing-store
		// resolution) are still whatever the last `drawBackground()` call set them to, until the
		// next draw. `clamp()` must key off the live size (matching zoomToFit's own offset math)
		// or the freshly-centered offset gets immediately overwritten by a clamp computed
		// against the wrong, smaller/larger stale size -- visibly sticking the image to one edge.
		const bitmap = { width: 500, height: 1000 }; // tall image
		session.projections.side.patient = {
			study: { series: { sopInstance: { bitmap } } }
		} as any;
		// Live layout size is now a 1000x1000 square (e.g. the window just grew), but the
		// backing store is still the old, much smaller 100x100 from before the resize.
		container.mainCanvas = fake_canvas(1000, 1000, 100, 100);

		container.nav.zoomToFit();

		// scale = min(1000/500, 1000/1000) = 1; the image is narrower than the canvas at that
		// scale (500 < 1000), so offset.x should CENTER it: (1000 - 500*1)/2 = 250. Clamping
		// against the stale 100x100 backing store instead would wrongly take the "already wider
		// than the canvas" edge-clamp branch (500 >= 100) and collapse offset.x to 0 -- visibly
		// pinning the image to the left/top instead of centering it.
		expect(container.nav.view.scale).toBeCloseTo(1);
		expect(container.nav.view.offset.x).toBeCloseTo(250);
		expect(container.nav.view.offset.y).toBeCloseTo(0);
	});
});

describe('ViewportController.syncToViewportSize', () => {
	beforeEach(() => {
		const bitmap = { width: 1000, height: 1000 };
		session.projections.side.patient = {
			study: { series: { sopInstance: { bitmap } } }
		} as any;
		container.mainCanvas = fake_canvas(500, 500);
		container.nav.zoomToFit(); // scale = minScale = 0.5, offset centered
	});

	it('preserves a custom zoom level instead of resetting it to fit, unlike zoomToFit()', () => {
		container.nav.view.scale = 2; // the user zoomed in manually
		container.mainCanvas = fake_canvas(800, 800); // window grew

		container.nav.syncToViewportSize();

		expect(container.nav.view.scale).toBeCloseTo(2);
	});

	it('recomputes minScale/maxScale for the new canvas size', () => {
		container.mainCanvas = fake_canvas(800, 800);

		container.nav.syncToViewportSize();

		expect(container.nav.minScale).toBeCloseTo(0.8);
		expect(container.nav.maxScale).toBeCloseTo(12.8);
	});

	it('pulls scale down to the new maxScale if the resize made it invalid', () => {
		container.nav.view.scale = 100;
		container.mainCanvas = fake_canvas(200, 200); // window shrank a lot -> maxScale drops

		container.nav.syncToViewportSize();

		expect(container.nav.view.scale).toBeCloseTo(container.nav.maxScale);
	});

	it('pulls scale up to the new minScale if the resize made it invalid', () => {
		container.nav.view.scale = 0.1;
		container.mainCanvas = fake_canvas(2000, 2000); // window grew a lot -> minScale rises above 0.1

		container.nav.syncToViewportSize();

		expect(container.nav.view.scale).toBeCloseTo(container.nav.minScale);
	});

	it('keeps the same world point centered when the canvas grows -- not anchored to top-left', () => {
		// Regression test: this only shows up while zoomed in enough that the image doesn't
		// fully fit the viewport on that axis (scaledSize >= canvasSize) -- when it DOES fit,
		// getClampedOffset's own "center if smaller" branch recenters unconditionally regardless
		// of the incoming offset, which is what made this bug easy to miss. Simulate a user
		// zoomed to 2x and panned so the image's own center sits at the (500, 500) viewport's
		// center: offset = -750 satisfies world(500,500) -> screen(250,250) at scale 2.
		container.nav.view.scale = 2;
		container.nav.view.offset = { x: -750, y: -750 };
		container.mainCanvas = fake_canvas(900, 500); // grows wider only, same height

		container.nav.syncToViewportSize();

		// The image's center (world (500, 500)) should still land at the new viewport's center
		// (450, 250) -- i.e. offset.x should shift by half the added width (200), not stay put.
		expect(container.nav.view.offset.x).toBeCloseTo(-550);
		expect(container.nav.view.offset.y).toBeCloseTo(-750); // height unchanged -> no y shift
	});

	it('re-clamps the offset so it stays valid even if the recentered value would not be', () => {
		container.nav.view.offset = { x: -10000, y: -10000 };
		container.mainCanvas = fake_canvas(800, 800);

		container.nav.syncToViewportSize();

		const scaledSize = 1000 * container.nav.view.scale;
		expect(container.nav.view.offset.x).toBeGreaterThanOrEqual(800 - scaledSize);
		expect(container.nav.view.offset.y).toBeGreaterThanOrEqual(800 - scaledSize);
	});

	it('is a no-op with no mainCanvas', () => {
		container.nav.view.scale = 2;
		container.mainCanvas = null;

		expect(() => container.nav.syncToViewportSize()).not.toThrow();
		expect(container.nav.view.scale).toBe(2);
	});

	it('is a no-op with no bitmap loaded', () => {
		session.projections.side.patient = null;
		container.nav.view.scale = 2;

		expect(() => container.nav.syncToViewportSize()).not.toThrow();
		expect(container.nav.view.scale).toBe(2);
	});
});

describe('ViewportController.clear', () => {
	it('resets the view to the identity offset/scale', () => {
		container.nav.view = { offset: { x: 50, y: 50 }, scale: 3 };
		container.nav.clear();
		expect(container.nav.view).toEqual({ offset: { x: 0, y: 0 }, scale: 1 });
	});
});
