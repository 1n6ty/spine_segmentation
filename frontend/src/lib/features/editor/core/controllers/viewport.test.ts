import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { InstanceContainer } from '../instance-container.svelte';
import { SessionService } from '$lib/core/session/session.svelte';

class FakeElement {
	setPointerCapture = vi.fn();
	releasePointerCapture = vi.fn();
}

function fake_canvas(clientWidth = 800, clientHeight = 600) {
	return {
		clientWidth,
		clientHeight,
		width: clientWidth,
		height: clientHeight,
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
});

describe('ViewportController.clear', () => {
	it('resets the view to the identity offset/scale', () => {
		container.nav.view = { offset: { x: 50, y: 50 }, scale: 3 };
		container.nav.clear();
		expect(container.nav.view).toEqual({ offset: { x: 0, y: 0 }, scale: 1 });
	});
});
