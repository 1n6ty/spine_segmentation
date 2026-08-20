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

describe('ToolController.setActiveTool', () => {
	it('switches the active tool and clears the selection', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		container.tools.handlePointerDown(fake_pointer_event({ clientX: 100, clientY: 100 }));
		expect(container.tools.selection.has(poly.uuid)).toBe(true);

		container.tools.setActiveTool('draw');

		expect(container.tools.activeToolId).toBe('draw');
		expect(container.tools.selection.isEmpty).toBe(true);
	});

	it('is a no-op when switching to the already-active tool (selection is preserved)', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		container.tools.handlePointerDown(fake_pointer_event({ clientX: 100, clientY: 100 }));

		container.tools.setActiveTool('select');

		expect(container.tools.selection.has(poly.uuid)).toBe(true);
	});

	it('switching away from draw resets any in-progress draft points', () => {
		container.tools.setActiveTool('draw');
		container.tools.handlePointerDown(fake_pointer_event({ clientX: 5, clientY: 5 }));
		expect(container.tools.draftPoints).toHaveLength(1);

		container.tools.setActiveTool('select');

		expect(container.tools.draftPoints).toEqual([]);
	});
});

describe('ToolController.handlePointerDown middle-mouse pan', () => {
	it.each(['select', 'draw', 'pan'] as const)(
		'button 1 always pans regardless of the active tool (%s)',
		(activeTool) => {
			container.tools.setActiveTool(activeTool);
			const target = new FakeElement();

			container.tools.handlePointerDown(fake_pointer_event({ button: 1, target: target as any }));

			expect(container.nav.isDragging).toBe(true);
			expect(target.setPointerCapture).toHaveBeenCalled();
		}
	);

	it('does not accumulate a draft point in the draw tool when button 1 is used', () => {
		container.tools.setActiveTool('draw');

		container.tools.handlePointerDown(fake_pointer_event({ button: 1 }));

		expect(container.tools.draftPoints).toEqual([]);
	});
});

describe('ToolController pointer move/up routing while a viewport drag is in flight', () => {
	it('routes move/up to the viewport while dragging, regardless of the active tool', () => {
		container.tools.setActiveTool('select');
		container.tools.handlePointerDown(fake_pointer_event({ button: 1, clientX: 10, clientY: 10 }));

		container.tools.handlePointerMove(fake_pointer_event({ clientX: 25, clientY: 15 }));
		expect(container.nav.view.offset).toEqual({ x: 15, y: 5 });

		container.tools.handlePointerUp(fake_pointer_event());
		expect(container.nav.isDragging).toBe(false);
	});

	it('forwards move/up to the active tool when no viewport drag is in flight', () => {
		container.tools.setActiveTool('draw');
		container.tools.handlePointerDown(fake_pointer_event({ clientX: 5, clientY: 5 }));

		expect(container.tools.draftPoints).toHaveLength(1);
	});
});

describe('ToolController.deleteSelected', () => {
	it('is a no-op with nothing selected', () => {
		session.projections.side.polygons = [square('C2', 0, 0)];
		container.tools.deleteSelected();
		expect(session.projections.side.polygons).toHaveLength(1);
	});

	it('removes exactly the selected subset, leaving the rest untouched', () => {
		const polys = [
			square('a', 0, 0),
			square('b', 50, 0),
			square('c', 100, 0),
			square('d', 150, 0),
			square('e', 200, 0)
		];
		session.projections.side.polygons = polys;
		container.tools.selection.replaceWith([polys[1].uuid, polys[2].uuid, polys[4].uuid]);

		const history_push = vi.spyOn(container.tools.history, 'push');
		container.tools.deleteSelected();

		const remainingUuids = session.projections.side.polygons.map((p) => p.uuid).sort();
		expect(remainingUuids).toEqual([polys[0].uuid, polys[3].uuid].sort());
		expect(history_push).toHaveBeenCalledTimes(1);
		expect(container.tools.selection.isEmpty).toBe(true);
	});

	it('a single-item selection deletes exactly that one polygon (parity with single delete)', () => {
		const c2 = square('C2', 0, 0);
		session.projections.side.polygons = [c2];
		container.tools.selection.selectOnly(c2.uuid);

		container.tools.deleteSelected();

		expect(session.projections.side.polygons).toHaveLength(0);
		expect(container.tools.selection.isEmpty).toBe(true);
	});
});

describe('ToolController.cursor', () => {
	it('is grabbing while the viewport itself is being dragged, overriding the active tool cursor', () => {
		container.tools.setActiveTool('draw'); // cursor-crosshair, would otherwise win
		container.nav.isDragging = true;

		expect(container.tools.cursor).toBe('cursor-grabbing');
	});

	it('otherwise delegates to the active tool', () => {
		container.tools.setActiveTool('draw');
		expect(container.tools.cursor).toBe('cursor-crosshair');
	});
});

describe('ToolController box-select (end-to-end through the controller)', () => {
	it('exposes the in-progress selection box and selects overlapping polygons on release', () => {
		const inside = square('in', 5, 5);
		const outside = square('out', 500, 500);
		session.projections.side.polygons = [inside, outside];

		expect(container.tools.selectionBox).toBeNull();

		container.tools.handlePointerDown(fake_pointer_event({ clientX: -50, clientY: -50 }));
		container.tools.handlePointerMove(fake_pointer_event({ clientX: 50, clientY: 50 }));

		expect(container.tools.selectionBox).toEqual({
			start: { x: -50, y: -50 },
			current: { x: 50, y: 50 }
		});

		container.tools.handlePointerUp(fake_pointer_event({ clientX: 50, clientY: 50 }));

		expect(container.tools.selection.has(inside.uuid)).toBe(true);
		expect(container.tools.selection.has(outside.uuid)).toBe(false);
		expect(container.tools.selectionBox).toBeNull();
	});
});

describe('ToolController draw flow (end-to-end through the controller)', () => {
	it('commits a new polygon on the 4th click and switches back to select', () => {
		container.tools.setActiveTool('draw');

		container.tools.handlePointerDown(fake_pointer_event({ clientX: 0, clientY: 0 }));
		container.tools.handlePointerDown(fake_pointer_event({ clientX: 0, clientY: 10 }));
		container.tools.handlePointerDown(fake_pointer_event({ clientX: 10, clientY: 10 }));
		container.tools.handlePointerDown(fake_pointer_event({ clientX: 10, clientY: 0 }));

		expect(session.projections.side.polygons).toHaveLength(1);
		expect(container.tools.activeToolId).toBe('select');
		expect(container.tools.selection.has(session.projections.side.polygons[0].uuid)).toBe(true);
	});
});

describe('ToolController vertex-drag flow (end-to-end through the controller)', () => {
	it('drags a vertex, then reorders/restores selection by uuid on release', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		const target = new FakeElement();

		// poly.points[0] === {x: 90, y: 110}.
		container.tools.handlePointerDown(
			fake_pointer_event({ clientX: 90, clientY: 110, target: target as any })
		);
		container.tools.handlePointerMove(fake_pointer_event({ clientX: 200, clientY: 210 }));
		container.tools.handlePointerUp(fake_pointer_event({ target: target as any }));

		expect(target.releasePointerCapture).toHaveBeenCalled();
		expect(session.projections.side.polygons[0].points).toContainEqual({ x: 200, y: 210 });
		expect(container.tools.selection.has(poly.uuid)).toBe(true);
	});
});

describe('ToolController central-line integration (Mode 1, end-to-end through the controller)', () => {
	it('dragging a plate-midpoint control point translates both its corner points together', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		const target = new FakeElement();

		// Bottom-plate midpoint sits at (100, 110), clear of any corner (nearest corner is
		// (90, 110) or (110, 110), 10px away -- outside the 12px hit radius is not guaranteed
		// here, but the control point itself is exactly on target so it wins regardless).
		container.tools.handlePointerDown(
			fake_pointer_event({ clientX: 100, clientY: 110, target: target as any })
		);
		expect(container.centralLine.isDragging).toBe(true);

		container.tools.handlePointerMove(fake_pointer_event({ clientX: 150, clientY: 160 }));
		container.tools.handlePointerUp(fake_pointer_event({ target: target as any }));

		expect(container.centralLine.isDragging).toBe(false);
		expect(session.projections.side.polygons[0].points).toContainEqual({ x: 140, y: 160 });
		expect(session.projections.side.polygons[0].points).toContainEqual({ x: 160, y: 160 });
		expect(target.releasePointerCapture).toHaveBeenCalled();
	});

	it('a plain vertex click still wins over a nearby control point when the vertex is nearer', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		const target = new FakeElement();

		// poly.points[0] === {x: 90, y: 110}, exactly on target; the bottom-plate control point
		// at (100, 110) is 10px away -- the vertex, being nearer, must win the dispatch.
		container.tools.handlePointerDown(
			fake_pointer_event({ clientX: 90, clientY: 110, target: target as any })
		);

		expect(container.centralLine.isDragging).toBe(false);

		container.tools.handlePointerMove(fake_pointer_event({ clientX: 200, clientY: 210 }));
		container.tools.handlePointerUp(fake_pointer_event({ target: target as any }));

		expect(session.projections.side.polygons[0].points).toContainEqual({ x: 200, y: 210 });
	});

	it('central-line control points are inert outside the select tool', () => {
		const poly = square('C2', 100, 100);
		session.projections.side.polygons = [poly];
		container.tools.setActiveTool('draw');

		container.tools.handlePointerDown(fake_pointer_event({ clientX: 100, clientY: 110 }));

		expect(container.centralLine.isDragging).toBe(false);
		expect(container.tools.draftPoints).toHaveLength(1);
	});
});

describe('ToolController.clear', () => {
	it("resets tool/history/selection and empties only this controller's own projection", () => {
		session.projections.side.polygons = [square('C2', 0, 0)];
		session.projections.frontal.polygons = [square('C2', 0, 0)];
		container.tools.setActiveTool('draw');
		container.tools.handlePointerDown(fake_pointer_event({ clientX: 1, clientY: 1 }));
		container.tools.selection.selectOnly('C2');

		container.tools.clear();

		expect(session.projections.side.polygons).toEqual([]);
		expect(session.projections.frontal.polygons).toHaveLength(1);
		expect(container.tools.activeToolId).toBe('select');
		expect(container.tools.draftPoints).toEqual([]);
		expect(container.tools.selection.isEmpty).toBe(true);
		expect(container.tools.history.canUndo).toBe(false);
	});
});
