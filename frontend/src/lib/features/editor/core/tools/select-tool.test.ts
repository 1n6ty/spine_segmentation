import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { SelectTool } from './select-tool.svelte';
import { PolygonSelectionState, type SelectionEntry } from '../selection-state.svelte';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import type { ToolContext } from './tool.type';

function vertebra(polygonUuid: string): SelectionEntry {
	return { kind: 'vertebra', polygonUuid };
}
function side(polygonUuid: string, side: 'left' | 'right'): SelectionEntry {
	return { kind: 'side', polygonUuid, side };
}
function point(polygonUuid: string, pointIndex: number): SelectionEntry {
	return { kind: 'point', polygonUuid, pointIndex };
}

function poly(uuid: string, minX: number, minY: number, maxX: number, maxY: number): Polygon {
	// [bottom-left, top-left, top-right, bottom-right], matching orderer.ts's convention.
	return {
		uuid,
		id: uuid,
		points: [
			{ x: minX, y: maxY },
			{ x: minX, y: minY },
			{ x: maxX, y: minY },
			{ x: maxX, y: maxY }
		]
	};
}

class FakeElement {
	setPointerCapture = vi.fn();
	releasePointerCapture = vi.fn();
}

function fake_pointer_event(overrides: Partial<PointerEvent> = {}): PointerEvent {
	return {
		clientX: 0,
		clientY: 0,
		pointerId: 1,
		target: new FakeElement(),
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		...overrides
	} as unknown as PointerEvent;
}

function fake_ctx(
	entities: Polygon[] = []
): ToolContext<Polygon> & { hitTestEntity: Mock<(worldPoint: Point) => SelectionEntry | null> } {
	return {
		entities,
		setEntities: vi.fn(),
		selection: new PolygonSelectionState(),
		history: { push: vi.fn() } as unknown as ToolContext<Polygon>['history'],
		viewport: { isDragging: false, beginDrag: vi.fn(), updateDrag: vi.fn(), endDrag: vi.fn() },
		worldPointFromEvent: (e) => ({ x: (e as any).clientX, y: (e as any).clientY }),
		hitTestEntity: vi.fn((_worldPoint: Point): SelectionEntry | null => null),
		createEntity: vi.fn(),
		setEntityPoint: vi.fn((entity: Polygon, i: number, p: Point) => {
			entity.points[i] = { ...p };
		}),
		reorder: (entities) => entities,
		requestSave: vi.fn(),
		requestToolSwitch: vi.fn()
	};
}

let tool: SelectTool;

beforeEach(() => {
	vi.stubGlobal('Element', FakeElement);
	tool = new SelectTool();
});

describe('SelectTool click selection (no movement)', () => {
	it('plain click on empty space clears the selection', () => {
		const ctx = fake_ctx();
		ctx.selection.selectOnly(vertebra('a'));

		tool.onPointerDown(fake_pointer_event(), ctx);

		expect(ctx.selection.isEmpty).toBe(true);
	});

	it('plain click on an unselected vertebra replace-selects it immediately', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(vertebra('a'));

		tool.onPointerDown(fake_pointer_event(), ctx);

		expect(ctx.selection.all).toEqual([vertebra('a')]);
	});

	it('plain click on the sole-selected entity (no movement) deselects it', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.selection.selectOnly(vertebra('a'));
		ctx.hitTestEntity.mockReturnValue(vertebra('a'));

		tool.onPointerDown(fake_pointer_event(), ctx);
		tool.onPointerUp(fake_pointer_event(), ctx);

		expect(ctx.selection.isEmpty).toBe(true);
	});

	it('plain click (no movement) on one member of a multi-selection collapses the selection to just that entity', () => {
		const a = poly('a', 0, 0, 10, 10);
		const b = poly('b', 20, 0, 30, 10);
		const ctx = fake_ctx([a, b]);
		ctx.selection.replaceWithMany([vertebra('a'), vertebra('b')]);
		ctx.hitTestEntity.mockReturnValue(vertebra('a'));

		tool.onPointerDown(fake_pointer_event(), ctx);
		tool.onPointerUp(fake_pointer_event(), ctx);

		expect(ctx.selection.all).toEqual([vertebra('a')]);
	});

	it('a side hit selects only that side', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(side('a', 'left'));

		tool.onPointerDown(fake_pointer_event(), ctx);

		expect(ctx.selection.all).toEqual([side('a', 'left')]);
	});

	it('a point hit selects only that point', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(point('a', 2));

		tool.onPointerDown(fake_pointer_event(), ctx);

		expect(ctx.selection.all).toEqual([point('a', 2)]);
	});

	it('Ctrl+click toggles the hit entity, agnostic of granularity, without arming a drag', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(side('a', 'right'));

		tool.onPointerDown(fake_pointer_event({ ctrlKey: true }), ctx);
		expect(ctx.selection.has(side('a', 'right'))).toBe(true);

		tool.onPointerDown(fake_pointer_event({ ctrlKey: true }), ctx);
		expect(ctx.selection.has(side('a', 'right'))).toBe(false);

		expect(ctx.history.push).not.toHaveBeenCalled();
	});

	it('Cmd (metaKey)+click also toggles the hit entity', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(vertebra('a'));

		tool.onPointerDown(fake_pointer_event({ metaKey: true }), ctx);
		expect(ctx.selection.has(vertebra('a'))).toBe(true);
	});

	it('Ctrl+click allows a mixed-granularity selection to coexist', () => {
		const a = poly('a', 0, 0, 10, 10);
		const b = poly('b', 20, 0, 30, 10);
		const c = poly('c', 40, 0, 50, 10);
		const ctx = fake_ctx([a, b, c]);

		ctx.hitTestEntity.mockReturnValue(vertebra('a'));
		tool.onPointerDown(fake_pointer_event({ ctrlKey: true }), ctx);
		ctx.hitTestEntity.mockReturnValue(side('b', 'left'));
		tool.onPointerDown(fake_pointer_event({ ctrlKey: true }), ctx);
		ctx.hitTestEntity.mockReturnValue(point('c', 0));
		tool.onPointerDown(fake_pointer_event({ ctrlKey: true }), ctx);

		expect(ctx.selection.size).toBe(3);
		expect(ctx.selection.has(vertebra('a'))).toBe(true);
		expect(ctx.selection.has(side('b', 'left'))).toBe(true);
		expect(ctx.selection.has(point('c', 0))).toBe(true);
	});

	it('Shift+click range-selects the flattened point set using entity order, without arming a drag', () => {
		const a = poly('a', 0, 0, 1, 1);
		const b = poly('b', 10, 0, 11, 1);
		const c = poly('c', 20, 0, 21, 1);
		const ctx = fake_ctx([a, b, c]);

		ctx.hitTestEntity.mockReturnValue(vertebra('a'));
		tool.onPointerDown(fake_pointer_event(), ctx);

		ctx.hitTestEntity.mockReturnValue(vertebra('c'));
		const pushCallsBeforeShiftClick = (ctx.history.push as Mock).mock.calls.length;
		tool.onPointerDown(fake_pointer_event({ shiftKey: true }), ctx);

		expect(ctx.selection.size).toBe(12);
		for (const uuid of ['a', 'b', 'c']) {
			for (let i = 0; i < 4; i++) expect(ctx.selection.has(point(uuid, i))).toBe(true);
		}
		// The Shift+click itself doesn't arm a drag/push history -- only the earlier plain click
		// (which set the anchor) did.
		expect((ctx.history.push as Mock).mock.calls.length).toBe(pushCallsBeforeShiftClick);
	});
});

describe('SelectTool entity/group drag', () => {
	it('a hit on an unselected entity starts a drag, replace-selects it, pushes history once, and captures the pointer', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(vertebra('a'));
		const target = new FakeElement();

		tool.onPointerDown(fake_pointer_event({ target: target as any }), ctx);

		expect(ctx.selection.all).toEqual([vertebra('a')]);
		expect(ctx.history.push).toHaveBeenCalledTimes(1);
		expect(target.setPointerCapture).toHaveBeenCalledWith(1);
		expect(tool.getCursor(ctx)).toBe('cursor-grabbing');
	});

	it('dragging a lone point moves only that point', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(point('a', 1)); // top-left, (0,0)

		tool.onPointerDown(fake_pointer_event(), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 42, clientY: 7 }), ctx);

		expect(a.points[1]).toEqual({ x: 42, y: 7 });
		expect(a.points[0]).toEqual({ x: 0, y: 10 }); // untouched
	});

	it('dragging a side moves both of its points by the same delta', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(side('a', 'left')); // points[0], points[1]

		tool.onPointerDown(fake_pointer_event(), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 100, clientY: 100 }), ctx);

		expect(a.points[0]).toEqual({ x: 100, y: 110 }); // (0,10) + (100,100)
		expect(a.points[1]).toEqual({ x: 100, y: 100 }); // (0,0) + (100,100)
		expect(a.points[2]).toEqual({ x: 10, y: 0 }); // untouched
		expect(a.points[3]).toEqual({ x: 10, y: 10 }); // untouched
	});

	it('dragging a member of a multi-selection moves the WHOLE selection together, across polygons', () => {
		const a = poly('a', 0, 0, 10, 10);
		const b = poly('b', 100, 100, 110, 110);
		const ctx = fake_ctx([a, b]);
		ctx.selection.replaceWithMany([vertebra('a'), point('b', 0)]);
		ctx.hitTestEntity.mockReturnValue(vertebra('a')); // clicking the already-selected vertebra

		tool.onPointerDown(fake_pointer_event(), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 5, clientY: 5 }), ctx);

		// All 4 of a's points shift by (5,5) ...
		expect(a.points[0]).toEqual({ x: 5, y: 15 });
		expect(a.points[1]).toEqual({ x: 5, y: 5 });
		expect(a.points[2]).toEqual({ x: 15, y: 5 });
		expect(a.points[3]).toEqual({ x: 15, y: 15 });
		// ... and b's only-selected point (index 0) shifts too, by the same delta.
		expect(b.points[0]).toEqual({ x: 105, y: 115 });
		// b's unselected points are untouched.
		expect(b.points[1]).toEqual({ x: 100, y: 100 });
	});

	it('a hit below the drag threshold does not move any point', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(point('a', 0));

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0 }), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 1, clientY: 1 }), ctx);

		expect(a.points[0]).toEqual({ x: 0, y: 10 });
	});

	it('pointer up after a confirmed drag releases capture, reorders + saves, and keeps the selection', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(vertebra('a'));
		const target = new FakeElement();
		tool.onPointerDown(fake_pointer_event({ target: target as any }), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 50, clientY: 50 }), ctx);

		tool.onPointerUp(fake_pointer_event({ target: target as any }), ctx);

		expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(ctx.setEntities).toHaveBeenCalledWith([a]);
		expect(ctx.requestSave).toHaveBeenCalled();
		expect(ctx.selection.has(vertebra('a'))).toBe(true);
	});

	it('pointer up with no confirmed movement does not reorder/save', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(vertebra('a'));

		tool.onPointerDown(fake_pointer_event(), ctx);
		tool.onPointerUp(fake_pointer_event(), ctx);

		expect(ctx.setEntities).not.toHaveBeenCalled();
		expect(ctx.requestSave).not.toHaveBeenCalled();
	});
});

describe('SelectTool box-select', () => {
	it('replaces the selection with whatever classifyRectSelection computes for the drawn box', () => {
		const inside = poly('inside', 2, 2, 4, 4);
		const outside = poly('outside', 100, 100, 110, 110);
		const ctx = fake_ctx([inside, outside]);

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0 }), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);

		expect(ctx.selection.all).toEqual([vertebra('inside')]);
	});

	it('captures the pointer on the down that starts a box-drag, and releases it on up', () => {
		const inside = poly('inside', 2, 2, 4, 4);
		const ctx = fake_ctx([inside]);
		const target = new FakeElement();

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0, target: target as any }), ctx);
		expect(target.setPointerCapture).toHaveBeenCalledWith(1);

		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 10, clientY: 10, target: target as any }), ctx);
		expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
	});

	it('keeps receiving the drag even when pointerup lands on a different element (e.g. the minimap overlapping the canvas corner) -- regression test for the capture above', () => {
		const inside = poly('inside', 2, 2, 4, 4);
		const ctx = fake_ctx([inside]);
		const downTarget = new FakeElement();
		const upTarget = new FakeElement();

		tool.onPointerDown(
			fake_pointer_event({ clientX: 0, clientY: 0, target: downTarget as any }),
			ctx
		);
		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);
		tool.onPointerUp(
			fake_pointer_event({ clientX: 10, clientY: 10, target: upTarget as any }),
			ctx
		);

		expect(ctx.selection.all).toEqual([vertebra('inside')]);
		expect(downTarget.setPointerCapture).toHaveBeenCalledWith(1);
		expect(upTarget.releasePointerCapture).toHaveBeenCalledWith(1);
	});

	it('Ctrl-held box-select toggles the computed entries into the current selection', () => {
		const already = poly('already', 200, 200, 210, 210);
		const boxed = poly('boxed', 2, 2, 4, 4);
		const ctx = fake_ctx([already, boxed]);
		ctx.selection.selectOnly(vertebra('already'));

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0, ctrlKey: true }), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10, ctrlKey: true }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);

		expect(ctx.selection.has(vertebra('already'))).toBe(true);
		expect(ctx.selection.has(vertebra('boxed'))).toBe(true);
	});

	it('Shift-held box-select keeps the tentative-clear from firing on pointerdown, then expands the point-range from the anchor to the touched vertebra', () => {
		const already = poly('already', 200, 200, 210, 210);
		const boxed = poly('boxed', 2, 2, 4, 4);
		const ctx = fake_ctx([already, boxed]);
		ctx.selection.selectOnly(vertebra('already')); // sets the anchor

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0, shiftKey: true }), ctx);
		expect(ctx.selection.has(vertebra('already'))).toBe(true); // not tentatively cleared

		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10, shiftKey: true }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);

		// Shift expands to the flattened point range spanning the anchor ('already') through
		// whatever vertebra the box touched ('boxed') -- same point-granularity semantics as
		// Shift+click, not a raw vertebra entry for 'boxed'.
		expect(ctx.selection.has(point('boxed', 0))).toBe(true);
		expect(ctx.selection.has(point('already', 0))).toBe(true);
	});

	it('a down/up pair with negligible movement behaves as a plain deselect-click, not a box-select', () => {
		const inside = poly('inside', -100, -100, 100, 100);
		const ctx = fake_ctx([inside]);
		ctx.selection.selectOnly(vertebra('inside'));

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0 }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 1, clientY: 1 }), ctx);

		// The tentative clear from pointerdown stands; no box-select ran despite the box
		// technically overlapping `inside`.
		expect(ctx.selection.isEmpty).toBe(true);
	});
});

describe('SelectTool.onActivate / onDeactivate', () => {
	it('reset all transient gesture state', () => {
		const a = poly('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTestEntity.mockReturnValue(vertebra('a'));
		tool.onPointerDown(fake_pointer_event(), ctx);
		expect(tool.getCursor(ctx)).toBe('cursor-grabbing');

		tool.onDeactivate(ctx);
		expect(tool.getCursor(ctx)).toBe('cursor-default');

		tool.onActivate(ctx);
		expect(tool.box).toBeNull();
	});
});
