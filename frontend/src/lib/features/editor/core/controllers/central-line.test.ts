import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { InstanceContainer } from '../instance-container.svelte';
import { SessionService } from '$lib/core/session/session.svelte';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

class FakeElement {
	setPointerCapture = vi.fn();
	releasePointerCapture = vi.fn();
}

function fake_canvas() {
	return {
		clientWidth: 800,
		clientHeight: 600,
		width: 800,
		height: 600,
		getBoundingClientRect: () => ({ left: 0, top: 0 })
	} as unknown as HTMLCanvasElement;
}

function fake_pointer_event(overrides: Partial<PointerEvent> = {}) {
	return {
		clientX: 0,
		clientY: 0,
		pointerId: 1,
		button: 0,
		target: new FakeElement(),
		...overrides
	} as unknown as PointerEvent;
}

function square(id: string, cx: number, cy: number, h = 10): Polygon {
	return {
		uuid: id,
		id,
		points: [
			{ x: cx - h, y: cy + h },
			{ x: cx - h, y: cy - h },
			{ x: cx + h, y: cy - h },
			{ x: cx + h, y: cy + h }
		]
	};
}

// S1's bottom-plate midpoint (100, 150) and L5's top-plate midpoint (100, 90) are the spine's
// outermost points -- dropped from the structure entirely by `computeCentralPath`. Only the
// interior pair -- S1's top-plate midpoint (100, 130) and L5's bottom-plate midpoint (100, 110)
// -- are part of the curve and hittable/draggable.
function two_vertebrae(): [Polygon, Polygon] {
	return [square('S1', 100, 140), square('L5', 100, 100)];
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

describe('CentralLineController.centralPath', () => {
	it('is null with no vertebrae', () => {
		expect(container.centralLine.centralPath).toBeNull();
	});

	it('is null with a single vertebra (both its midpoints are spine-outermost)', () => {
		session.projections.side.polygons = [square('S1', 100, 100)];
		expect(container.centralLine.centralPath).toBeNull();
	});

	it('is derived from the current polygons, excluding the spine-outermost points', () => {
		session.projections.side.polygons = two_vertebrae();
		expect(container.centralLine.centralPath?.controlPoints).toHaveLength(2);
	});
});

describe('CentralLineController.hitTest', () => {
	it('returns null when nothing is within the hit radius', () => {
		session.projections.side.polygons = two_vertebrae();
		expect(container.centralLine.hitTest({ x: 1000, y: 1000 })).toBeNull();
	});

	it('hits the nearest interior control point (S1 top-plate midpoint) within radius', () => {
		const [s1] = two_vertebrae();
		session.projections.side.polygons = [s1, square('L5', 100, 100)];

		const hit = container.centralLine.hitTest({ x: 101, y: 131 });

		expect(hit?.polygon.uuid).toBe(s1.uuid);
		expect(hit?.controlPoint.plate).toBe('top');
		expect(hit?.controlPoint.cornerIndices).toEqual([1, 2]);
	});

	it('never hits the spine-outermost points -- they are not part of the structure at all', () => {
		session.projections.side.polygons = two_vertebrae();

		// S1's bottom-plate midpoint (100, 150) and L5's top-plate midpoint (100, 90).
		expect(container.centralLine.hitTest({ x: 100, y: 150 })).toBeNull();
		expect(container.centralLine.hitTest({ x: 100, y: 90 })).toBeNull();
	});
});

describe('CentralLineController drag lifecycle (Mode 1)', () => {
	it('beginDrag selects the polygon and pushes history', () => {
		const [s1, l5] = two_vertebrae();
		session.projections.side.polygons = [s1, l5];
		const hit = container.centralLine.hitTest({ x: 100, y: 130 })!;
		const history_push = vi.spyOn(container.tools.history, 'push');
		const target = new FakeElement();

		container.centralLine.beginDrag(fake_pointer_event({ target: target as any }), hit);

		expect(container.centralLine.isDragging).toBe(true);
		expect(container.tools.selection.has(s1.uuid)).toBe(true);
		expect(history_push).toHaveBeenCalledTimes(1);
		expect(target.setPointerCapture).toHaveBeenCalled();
	});

	it('updateDrag rigidly translates both corner points by the same delta', () => {
		const [s1, l5] = two_vertebrae();
		session.projections.side.polygons = [s1, l5];
		const hit = container.centralLine.hitTest({ x: 100, y: 130 })!;
		container.centralLine.beginDrag(fake_pointer_event(), hit);

		// S1's top-plate midpoint starts at (100, 130); drag it to (150, 180) -- delta (50, 50).
		container.centralLine.updateDrag({ x: 150, y: 180 });

		expect(s1.points[1]).toEqual({ x: 140, y: 180 }); // was (90, 130)
		expect(s1.points[2]).toEqual({ x: 160, y: 180 }); // was (110, 130)
		// Segment length/orientation preserved (still 20 apart, horizontal).
		expect(s1.points[2].x - s1.points[1].x).toBe(20);
		expect(s1.points[2].y - s1.points[1].y).toBe(0);
	});

	it('is a no-op when nothing is being dragged', () => {
		const [s1, l5] = two_vertebrae();
		session.projections.side.polygons = [s1, l5];
		const before = structuredClone(s1.points);

		container.centralLine.updateDrag({ x: 500, y: 500 });

		expect(s1.points).toEqual(before);
	});

	it('endDrag reorders/saves and clears the drag state', () => {
		const [s1, l5] = two_vertebrae();
		session.projections.side.polygons = [s1, l5];
		const hit = container.centralLine.hitTest({ x: 100, y: 130 })!;
		const target = new FakeElement();
		container.centralLine.beginDrag(fake_pointer_event({ target: target as any }), hit);
		container.centralLine.updateDrag({ x: 150, y: 180 });

		const requestSave = vi.spyOn(session, 'requestSave');
		container.centralLine.endDrag(fake_pointer_event({ target: target as any }));

		expect(container.centralLine.isDragging).toBe(false);
		expect(target.releasePointerCapture).toHaveBeenCalled();
		expect(requestSave).toHaveBeenCalledTimes(1);
	});
});

describe('CentralLineController.clear', () => {
	it('resets any in-progress drag state', () => {
		const [s1, l5] = two_vertebrae();
		session.projections.side.polygons = [s1, l5];
		const hit = container.centralLine.hitTest({ x: 100, y: 130 })!;
		container.centralLine.beginDrag(fake_pointer_event(), hit);
		expect(container.centralLine.isDragging).toBe(true);

		container.centralLine.clear();

		expect(container.centralLine.isDragging).toBe(false);
	});
});
