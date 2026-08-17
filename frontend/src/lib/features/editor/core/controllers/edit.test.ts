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
		target: new FakeElement(),
		...overrides
	} as unknown as PointerEvent;
}

function square(id: string, cx: number, cy: number): Polygon {
	const h = 10;
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

describe('EditController.setMode', () => {
	it('switches mode and clears draft points / selection', () => {
		container.edit.selectedPolygon = square('C2', 0, 0);
		container.edit.draftPoints = [{ x: 1, y: 1 }];

		container.edit.setMode('draw');

		expect(container.edit.mode).toBe('draw');
		expect(container.edit.draftPoints).toEqual([]);
		expect(container.edit.selectedPolygon).toBeNull();
	});
});

describe('EditController.cursor', () => {
	it('is grabbing while in drag mode', () => {
		container.edit.mode = 'drag';
		expect(container.edit.cursor).toBe('cursor-grabbing');
	});

	it('is crosshair while in draw mode', () => {
		container.edit.mode = 'draw';
		expect(container.edit.cursor).toBe('cursor-crosshair');
	});

	it('is grabbing in default mode while the viewport itself is being dragged', () => {
		container.nav.isDragging = true;
		expect(container.edit.cursor).toBe('cursor-grabbing');
	});

	it('is grab in default mode otherwise', () => {
		expect(container.edit.cursor).toBe('cursor-grab');
	});
});

describe('EditController.addPoint / commit', () => {
	it('accumulates draft points without committing until the 4th', () => {
		container.edit.setMode('draw');
		container.edit.addPoint({ x: 0, y: 0 });
		container.edit.addPoint({ x: 0, y: 10 });
		container.edit.addPoint({ x: 10, y: 10 });

		expect(container.edit.draftPoints).toHaveLength(3);
		expect(session.projections.side.polygons).toHaveLength(0);
	});

	it('commits a new polygon on the 4th point and resets draft state', () => {
		container.edit.setMode('draw');
		container.edit.addPoint({ x: 0, y: 0 });
		container.edit.addPoint({ x: 0, y: 10 });
		container.edit.addPoint({ x: 10, y: 10 });
		container.edit.addPoint({ x: 10, y: 0 });

		expect(session.projections.side.polygons).toHaveLength(1);
		expect(container.edit.draftPoints).toEqual([]);
		expect(container.edit.mode).toBe('default');
		expect(container.edit.selectedPolygon).not.toBeNull();
		expect(container.edit.selectedPolygon?.uuid).toBe(session.projections.side.polygons[0].uuid);
	});

	it('pushes exactly one history snapshot per commit', () => {
		container.edit.setMode('draw');
		const history_push = vi.spyOn(container.edit.history!, 'push');

		container.edit.addPoint({ x: 0, y: 0 });
		container.edit.addPoint({ x: 0, y: 10 });
		container.edit.addPoint({ x: 10, y: 10 });
		container.edit.addPoint({ x: 10, y: 0 });

		expect(history_push).toHaveBeenCalledTimes(1);
	});
});

describe('EditController.deleteSelected', () => {
	it('is a no-op with nothing selected', () => {
		session.projections.side.polygons = [square('C2', 0, 0)];
		container.edit.deleteSelected();
		expect(session.projections.side.polygons).toHaveLength(1);
	});

	it('removes the selected polygon and clears the selection', () => {
		const c2 = square('C2', 0, 0);
		session.projections.side.polygons = [c2];
		container.edit.selectedPolygon = c2;

		container.edit.deleteSelected();

		expect(session.projections.side.polygons).toHaveLength(0);
		expect(container.edit.selectedPolygon).toBeNull();
	});
});

describe('EditController.handlePointerDown', () => {
	it('in draw mode, delegates to addPoint instead of selecting', () => {
		container.edit.setMode('draw');
		container.edit.handlePointerDown(fake_pointer_event({ clientX: 5, clientY: 5 }));

		expect(container.edit.draftPoints).toHaveLength(1);
	});

	it('in default mode, clicking inside a polygon body selects it without entering drag', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];

		// (100,100) is the polygon's centroid -- well inside the body, >12px from any vertex.
		container.edit.handlePointerDown(fake_pointer_event({ clientX: 100, clientY: 100 }));

		expect(container.edit.selectedPolygon?.uuid).toBe(poly.uuid);
		expect(container.edit.mode).toBe('default');
	});

	it('clicking directly on a vertex starts a drag and captures the pointer', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		const target = new FakeElement();

		// poly.points[0] === {x: 90, y: 110}.
		container.edit.handlePointerDown(
			fake_pointer_event({ clientX: 90, clientY: 110, target: target as any })
		);

		expect(container.edit.mode).toBe('drag');
		expect(container.edit.dragIndex).toBe(0);
		expect(target.setPointerCapture).toHaveBeenCalledWith(1);
	});

	it('clicking empty space deselects', () => {
		session.projections.side.polygons = [square('C2', 100, 100)];
		container.edit.selectedPolygon = session.projections.side.polygons[0];

		container.edit.handlePointerDown(fake_pointer_event({ clientX: 0, clientY: 0 }));

		expect(container.edit.selectedPolygon).toBeNull();
	});
});

describe('EditController.handlePointerMove / handlePointerUp (dragging a vertex)', () => {
	it('updates the dragged vertex position live', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		container.edit.handlePointerDown(fake_pointer_event({ clientX: 90, clientY: 110 }));
		expect(container.edit.mode).toBe('drag');

		container.edit.handlePointerMove(fake_pointer_event({ clientX: 200, clientY: 210 }));

		expect(container.edit.selectedPolygon?.points[0]).toEqual({ x: 200, y: 210 });
	});

	it('pointer move while not dragging is a no-op', () => {
		container.edit.handlePointerMove(fake_pointer_event({ clientX: 200, clientY: 210 }));
		expect(container.edit.dragIndex).toBeNull();
	});

	it('pointer up ends the drag and releases pointer capture', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		const target = new FakeElement();
		container.edit.handlePointerDown(
			fake_pointer_event({ clientX: 90, clientY: 110, target: target as any })
		);
		container.edit.handlePointerMove(fake_pointer_event({ clientX: 200, clientY: 210 }));

		container.edit.handlePointerUp(fake_pointer_event({ target: target as any }));

		expect(container.edit.mode).toBe('default');
		expect(container.edit.dragIndex).toBeNull();
		expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(container.edit.selectedPolygon?.uuid).toBe(poly.uuid);
	});
});

describe('EditController.clear', () => {
	it('resets mode/history and empties only this controller\'s own projection', () => {
		session.projections.side.polygons = [square('C2', 0, 0)];
		session.projections.frontal.polygons = [square('C2', 0, 0)];
		container.edit.mode = 'draw';
		container.edit.draftPoints = [{ x: 1, y: 1 }];
		container.edit.selectedPolygon = session.projections.side.polygons[0];

		container.edit.clear();

		expect(session.projections.side.polygons).toEqual([]);
		expect(session.projections.frontal.polygons).toHaveLength(1);
		expect(container.edit.mode).toBe('default');
		expect(container.edit.draftPoints).toEqual([]);
		expect(container.edit.selectedPolygon).toBeNull();
		expect(container.edit.history?.canUndo).toBe(false);
	});
});
