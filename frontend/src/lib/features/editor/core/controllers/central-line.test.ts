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

	it('is derived from the current polygons', () => {
		session.projections.side.polygons = [square('S1', 100, 100)];
		expect(container.centralLine.centralPath?.controlPoints).toHaveLength(2);
	});
});

describe('CentralLineController.hitTest', () => {
	it('returns null when nothing is within the hit radius', () => {
		session.projections.side.polygons = [square('S1', 100, 100)];
		expect(container.centralLine.hitTest({ x: 1000, y: 1000 })).toBeNull();
	});

	it('hits the nearest control point (the bottom-plate midpoint) within radius', () => {
		const poly = square('S1', 100, 100);
		session.projections.side.polygons = [poly];

		// bottom-plate midpoint sits at (100, 110)
		const hit = container.centralLine.hitTest({ x: 101, y: 111 });

		expect(hit?.polygon.uuid).toBe(poly.uuid);
		expect(hit?.controlPoint.plate).toBe('bottom');
		expect(hit?.controlPoint.cornerIndices).toEqual([0, 3]);
	});
});

describe('CentralLineController drag lifecycle (Mode 1)', () => {
	it('beginDrag selects the polygon and pushes history', () => {
		const poly = square('S1', 100, 100);
		session.projections.side.polygons = [poly];
		const hit = container.centralLine.hitTest({ x: 100, y: 110 })!;
		const history_push = vi.spyOn(container.tools.history, 'push');
		const target = new FakeElement();

		container.centralLine.beginDrag(fake_pointer_event({ target: target as any }), hit);

		expect(container.centralLine.isDragging).toBe(true);
		expect(container.tools.selection.has(poly.uuid)).toBe(true);
		expect(history_push).toHaveBeenCalledTimes(1);
		expect(target.setPointerCapture).toHaveBeenCalled();
	});

	it('updateDrag rigidly translates both corner points by the same delta', () => {
		const poly = square('S1', 100, 100);
		session.projections.side.polygons = [poly];
		const hit = container.centralLine.hitTest({ x: 100, y: 110 })!;
		container.centralLine.beginDrag(fake_pointer_event(), hit);

		// Bottom-plate midpoint starts at (100, 110); drag it to (150, 160) -- delta (50, 50).
		container.centralLine.updateDrag({ x: 150, y: 160 });

		expect(poly.points[0]).toEqual({ x: 140, y: 160 }); // was (90, 110)
		expect(poly.points[3]).toEqual({ x: 160, y: 160 }); // was (110, 110)
		// Segment length/orientation preserved (still 20 apart, horizontal).
		expect(poly.points[3].x - poly.points[0].x).toBe(20);
		expect(poly.points[3].y - poly.points[0].y).toBe(0);
	});

	it('is a no-op when nothing is being dragged', () => {
		const poly = square('S1', 100, 100);
		session.projections.side.polygons = [poly];
		const before = structuredClone(poly.points);

		container.centralLine.updateDrag({ x: 500, y: 500 });

		expect(poly.points).toEqual(before);
	});

	it('endDrag reorders/saves and clears the drag state', () => {
		const poly = square('S1', 100, 100);
		session.projections.side.polygons = [poly];
		const hit = container.centralLine.hitTest({ x: 100, y: 110 })!;
		const target = new FakeElement();
		container.centralLine.beginDrag(fake_pointer_event({ target: target as any }), hit);
		container.centralLine.updateDrag({ x: 150, y: 160 });

		const requestSave = vi.spyOn(session, 'requestSave');
		container.centralLine.endDrag(fake_pointer_event({ target: target as any }));

		expect(container.centralLine.isDragging).toBe(false);
		expect(target.releasePointerCapture).toHaveBeenCalled();
		expect(requestSave).toHaveBeenCalledTimes(1);
	});
});

describe('CentralLineController.clear', () => {
	it('resets any in-progress drag state', () => {
		const poly = square('S1', 100, 100);
		session.projections.side.polygons = [poly];
		const hit = container.centralLine.hitTest({ x: 100, y: 110 })!;
		container.centralLine.beginDrag(fake_pointer_event(), hit);
		expect(container.centralLine.isDragging).toBe(true);

		container.centralLine.clear();

		expect(container.centralLine.isDragging).toBe(false);
	});
});
