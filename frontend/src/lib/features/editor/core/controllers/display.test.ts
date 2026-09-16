import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { InstanceContainer } from '../instance-container.svelte';
import { SessionService } from '$lib/core/session/session.svelte';

class FakeElement {
	setPointerCapture = vi.fn();
	releasePointerCapture = vi.fn();
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

function fake_sop_instance(overrides: Record<string, unknown> = {}) {
	return {
		dataMin: 0,
		dataMax: 100,
		originalWindowCenter: 50,
		originalWindowWidth: 100,
		rewindow: vi.fn().mockResolvedValue(undefined),
		...overrides
	};
}

let session: SessionService;
let container: InstanceContainer;

beforeEach(async () => {
	vi.stubGlobal('Element', FakeElement);
	// rAF fires synchronously so throttled commits are observable without awaiting a real frame.
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		cb(0);
		return 0;
	});

	session = new SessionService(null);
	await session.loadingPromise;
	container = new InstanceContainer('side', session);
});

describe('DisplayController.setOpacity', () => {
	it('clamps below 0 up to 0', () => {
		container.display.setOpacity(-1);
		expect(container.display.overlayOpacity).toBe(0);
	});

	it('clamps above 1 down to 1', () => {
		container.display.setOpacity(2);
		expect(container.display.overlayOpacity).toBe(1);
	});

	it('passes through an in-range value', () => {
		container.display.setOpacity(0.4);
		expect(container.display.overlayOpacity).toBe(0.4);
	});
});

describe('DisplayController display values with no sop instance', () => {
	it('displayCenter/displayWidth default to 0', () => {
		expect(container.display.displayCenter).toBe(0);
		expect(container.display.displayWidth).toBe(0);
	});

	it('padFraction defaults to the pad center', () => {
		expect(container.display.padFraction).toEqual({ tx: 0.5, ty: 0.5 });
	});
});

describe('DisplayController window dragging', () => {
	const sop = fake_sop_instance();

	beforeEach(() => {
		sop.rewindow.mockClear();
		session.projections.side.patient = { study: { series: { sopInstance: sop } } } as any;
	});

	it('before any drag, displayCenter/displayWidth show the sop instance original window', () => {
		expect(container.display.displayCenter).toBe(50);
		expect(container.display.displayWidth).toBe(100);
	});

	it('beginWindowDrag sets isDragging, captures the pointer, and rewindows from the pointer position', () => {
		const target = new FakeElement();
		const bounds = { left: 0, top: 0, width: 100, height: 100 };

		// Pointer at (25, 75) of a 100x100 pad over a [0,100] data range:
		// center = 100 - 0.25*100 = 75 (tx=0 is darkest/dataMax, tx=1 is brightest/dataMin);
		// width = 1 + 0.75*100*2 = 151.
		container.display.beginWindowDrag(
			fake_pointer_event({ clientX: 25, clientY: 75, target: target as any }),
			bounds
		);

		expect(container.display.isDragging).toBe(true);
		expect(target.setPointerCapture).toHaveBeenCalledWith(1);
		expect(container.display.displayCenter).toBe(75);
		expect(container.display.displayWidth).toBe(151);
		expect(sop.rewindow).toHaveBeenCalledWith(75, 151);
	});

	it('updateWindowDrag while not dragging is a no-op', () => {
		container.display.updateWindowDrag(fake_pointer_event({ clientX: 50, clientY: 50 }), {
			left: 0,
			top: 0,
			width: 100,
			height: 100
		});

		expect(sop.rewindow).not.toHaveBeenCalled();
		expect(container.display.displayCenter).toBe(50); // unchanged original
	});

	it('updateWindowDrag while dragging moves the window further', () => {
		const bounds = { left: 0, top: 0, width: 100, height: 100 };
		container.display.beginWindowDrag(fake_pointer_event({ clientX: 25, clientY: 75 }), bounds);
		sop.rewindow.mockClear();

		// tx=1 (rightmost) is brightest -> center = dataMin (0); ty=0 (topmost) is most contrast
		// -> width = MIN_WINDOW_WIDTH (1).
		container.display.updateWindowDrag(fake_pointer_event({ clientX: 100, clientY: 0 }), bounds);

		expect(container.display.displayCenter).toBe(0);
		expect(container.display.displayWidth).toBe(1);
		expect(sop.rewindow).toHaveBeenCalledWith(0, 1);
	});

	it('pointer position is clamped to the pad bounds, not extrapolated past them', () => {
		const bounds = { left: 0, top: 0, width: 100, height: 100 };
		container.display.beginWindowDrag(fake_pointer_event({ clientX: -50, clientY: 500 }), bounds);

		// tx clamps to 0 (leftmost, darkest) -> center = dataMax (100); ty clamps to 1 (bottommost,
		// least contrast) -> width = 2*range + MIN_WINDOW_WIDTH (201).
		expect(container.display.displayCenter).toBe(100);
		expect(container.display.displayWidth).toBe(201);
	});

	it('endWindowDrag clears isDragging, releases the pointer, and commits a final rewindow', () => {
		const target = new FakeElement();
		const bounds = { left: 0, top: 0, width: 100, height: 100 };
		container.display.beginWindowDrag(fake_pointer_event({ target: target as any }), bounds);
		sop.rewindow.mockClear();

		container.display.endWindowDrag(fake_pointer_event({ target: target as any }));

		expect(container.display.isDragging).toBe(false);
		expect(target.releasePointerCapture).toHaveBeenCalled();
		expect(sop.rewindow).toHaveBeenCalled();
	});

	it('resetWindow clears the override and rewindows back to the original values', () => {
		const bounds = { left: 0, top: 0, width: 100, height: 100 };
		container.display.beginWindowDrag(fake_pointer_event({ clientX: 100, clientY: 100 }), bounds);
		expect(container.display.displayCenter).not.toBe(50);
		sop.rewindow.mockClear();

		container.display.resetWindow();

		expect(container.display.displayCenter).toBe(50);
		expect(container.display.displayWidth).toBe(100);
		expect(sop.rewindow).toHaveBeenCalledWith(50, 100);
	});

	it('nudgeBrightness(1) increases brightnessFraction by one step and rewindows', () => {
		const before = container.display.brightnessFraction; // 0.5
		container.display.nudgeBrightness(1);

		expect(container.display.brightnessFraction).toBeCloseTo(before + 0.02);
		expect(sop.rewindow).toHaveBeenCalled();
	});

	it('nudgeBrightness(-1) decreases brightnessFraction by one step', () => {
		const before = container.display.brightnessFraction; // 0.5
		container.display.nudgeBrightness(-1);

		expect(container.display.brightnessFraction).toBeCloseTo(before - 0.02);
	});

	it('nudgeContrast(1) increases contrastFraction by one step and rewindows', () => {
		const before = container.display.contrastFraction;
		container.display.nudgeContrast(1);

		expect(container.display.contrastFraction).toBeCloseTo(before + 0.02);
		expect(sop.rewindow).toHaveBeenCalled();
	});

	it('nudgeContrast(-1) decreases contrastFraction by one step', () => {
		const before = container.display.contrastFraction;
		container.display.nudgeContrast(-1);

		expect(container.display.contrastFraction).toBeCloseTo(before - 0.02);
	});

	it('nudging clamps at the fraction bounds instead of going out of range', () => {
		for (let i = 0; i < 100; i++) container.display.nudgeBrightness(1);
		expect(container.display.brightnessFraction).toBeCloseTo(1);

		for (let i = 0; i < 100; i++) container.display.nudgeBrightness(-1);
		expect(container.display.brightnessFraction).toBeCloseTo(0);
	});

	it('padFraction reflects the current brightness/contrast as 0..1 fractions', () => {
		// original window: center=50, width=100 over data range [0,100] (range=100)
		// brightness = (100-50)/100 = 0.5; contrast = 1-(100-1)/(100*2) = 0.505; ty = 1-contrast
		expect(container.display.padFraction.tx).toBeCloseTo(0.5);
		expect(container.display.padFraction.ty).toBeCloseTo(0.495);
	});

	it('dragging right increases brightness (lower window center)', () => {
		const bounds = { left: 0, top: 0, width: 100, height: 100 };

		container.display.beginWindowDrag(fake_pointer_event({ clientX: 90, clientY: 50 }), bounds);
		const brightAtRight = container.display.brightnessFraction;

		container.display.updateWindowDrag(fake_pointer_event({ clientX: 10, clientY: 50 }), bounds);
		const brightAtLeft = container.display.brightnessFraction;

		expect(brightAtRight).toBeGreaterThan(brightAtLeft);
	});

	it('dragging toward the top increases contrast (narrower window)', () => {
		const bounds = { left: 0, top: 0, width: 100, height: 100 };

		container.display.beginWindowDrag(fake_pointer_event({ clientX: 50, clientY: 10 }), bounds);
		const contrastAtTop = container.display.contrastFraction;

		container.display.updateWindowDrag(fake_pointer_event({ clientX: 50, clientY: 90 }), bounds);
		const contrastAtBottom = container.display.contrastFraction;

		expect(contrastAtTop).toBeGreaterThan(contrastAtBottom);
	});
});
