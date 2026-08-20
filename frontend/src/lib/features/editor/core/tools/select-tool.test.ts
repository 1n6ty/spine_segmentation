import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { SelectTool } from './select-tool.svelte';
import { SelectionState } from '../selection-state.svelte';
import type { AABB, Point } from '$lib/shared/geometry/geometry.type';
import type { HitResult, ToolContext } from './tool.type';

type Item = { uuid: string; bounds: AABB };

function item(uuid: string, minX: number, minY: number, maxX: number, maxY: number): Item {
	return { uuid, bounds: { minX, minY, maxX, maxY } };
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
	entities: Item[] = []
): ToolContext<Item> & { hitTest: Mock<(worldPoint: Point) => HitResult<Item>> } {
	return {
		entities,
		setEntities: vi.fn(),
		selection: new SelectionState<Item>(),
		history: { push: vi.fn() } as unknown as ToolContext<Item>['history'],
		viewport: { isDragging: false, beginDrag: vi.fn(), updateDrag: vi.fn(), endDrag: vi.fn() },
		worldPointFromEvent: (e) => ({ x: (e as any).clientX, y: (e as any).clientY }),
		hitTest: vi.fn((_worldPoint: Point): HitResult<Item> => ({ entity: null, pointIndex: null })),
		boundsOf: (entity) => entity.bounds,
		createEntity: vi.fn(),
		setEntityPoint: vi.fn(),
		reorder: (entities) => entities,
		requestSave: vi.fn(),
		requestToolSwitch: vi.fn()
	};
}

let tool: SelectTool<Item>;

beforeEach(() => {
	vi.stubGlobal('Element', FakeElement);
	tool = new SelectTool<Item>();
});

describe('SelectTool click selection (body hit, no vertex)', () => {
	it('plain click on empty space clears the selection', () => {
		const ctx = fake_ctx();
		ctx.selection.selectOnly('a');

		tool.onPointerDown(fake_pointer_event(), ctx);

		expect(ctx.selection.isEmpty).toBe(true);
	});

	it('plain click on a body replace-selects it', () => {
		const a = item('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: null });

		tool.onPointerDown(fake_pointer_event(), ctx);

		expect([...ctx.selection.selected]).toEqual(['a']);
	});

	it('Ctrl+click toggles the item', () => {
		const a = item('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: null });

		tool.onPointerDown(fake_pointer_event({ ctrlKey: true }), ctx);
		expect(ctx.selection.has('a')).toBe(true);

		tool.onPointerDown(fake_pointer_event({ ctrlKey: true }), ctx);
		expect(ctx.selection.has('a')).toBe(false);
	});

	it('Cmd (metaKey)+click also toggles the item', () => {
		const a = item('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: null });

		tool.onPointerDown(fake_pointer_event({ metaKey: true }), ctx);
		expect(ctx.selection.has('a')).toBe(true);
	});

	it('Shift+click range-selects using entity order', () => {
		const a = item('a', 0, 0, 1, 1);
		const b = item('b', 10, 0, 11, 1);
		const c = item('c', 20, 0, 21, 1);
		const ctx = fake_ctx([a, b, c]);

		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: null });
		tool.onPointerDown(fake_pointer_event(), ctx);

		ctx.hitTest.mockReturnValue({ entity: c, pointIndex: null });
		tool.onPointerDown(fake_pointer_event({ shiftKey: true }), ctx);

		expect([...ctx.selection.selected].sort()).toEqual(['a', 'b', 'c']);
	});
});

describe('SelectTool vertex drag', () => {
	it('a vertex hit starts a drag, replace-selects the owner, pushes history once, and captures the pointer', () => {
		const a = item('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: 2 });
		const target = new FakeElement();

		tool.onPointerDown(fake_pointer_event({ target: target as any }), ctx);

		expect([...ctx.selection.selected]).toEqual(['a']);
		expect(ctx.history.push).toHaveBeenCalledTimes(1);
		expect(target.setPointerCapture).toHaveBeenCalledWith(1);
		expect(tool.getCursor(ctx)).toBe('cursor-grabbing');
	});

	it('a vertex hit ignores modifiers -- always replace-selects', () => {
		const a = item('a', 0, 0, 10, 10);
		const b = item('b', 20, 0, 30, 10);
		const ctx = fake_ctx([a, b]);
		ctx.selection.selectOnly('b');
		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: 0 });

		tool.onPointerDown(fake_pointer_event({ ctrlKey: true }), ctx);

		expect([...ctx.selection.selected]).toEqual(['a']);
	});

	it('pointer move during a drag calls setEntityPoint with the live world point', () => {
		const a = item('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: 1 });
		tool.onPointerDown(fake_pointer_event(), ctx);

		tool.onPointerMove(fake_pointer_event({ clientX: 42, clientY: 7 }), ctx);

		expect(ctx.setEntityPoint).toHaveBeenCalledWith(a, 1, { x: 42, y: 7 });
	});

	it('pointer up ends the drag, releases capture, reorders + saves, and selection still contains the dragged uuid (no restore step needed)', () => {
		const a = item('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: 0 });
		const target = new FakeElement();
		tool.onPointerDown(fake_pointer_event({ target: target as any }), ctx);

		tool.onPointerUp(fake_pointer_event({ target: target as any }), ctx);

		expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
		expect(ctx.setEntities).toHaveBeenCalledWith([a]);
		expect(ctx.requestSave).toHaveBeenCalled();
		expect(ctx.selection.has('a')).toBe(true);
	});
});

describe('SelectTool box-select', () => {
	it('replaces the selection with entities overlapping the drawn box (no modifier)', () => {
		const inside = item('inside', 2, 2, 4, 4);
		const outside = item('outside', 100, 100, 110, 110);
		const ctx = fake_ctx([inside, outside]);

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0 }), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);

		expect([...ctx.selection.selected]).toEqual(['inside']);
	});

	it('captures the pointer on the down that starts a box-drag, and releases it on up', () => {
		const inside = item('inside', 2, 2, 4, 4);
		const ctx = fake_ctx([inside]);
		const target = new FakeElement();

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0, target: target as any }), ctx);
		expect(target.setPointerCapture).toHaveBeenCalledWith(1);

		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 10, clientY: 10, target: target as any }), ctx);
		expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
	});

	it('keeps receiving the drag even when pointerup lands on a different element (e.g. the minimap overlapping the canvas corner) -- regression test for the capture above', () => {
		const inside = item('inside', 2, 2, 4, 4);
		const ctx = fake_ctx([inside]);
		const downTarget = new FakeElement();
		const upTarget = new FakeElement();

		tool.onPointerDown(
			fake_pointer_event({ clientX: 0, clientY: 0, target: downTarget as any }),
			ctx
		);
		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);
		// Pointer capture means this tool's onPointerUp still gets called even
		// though e.target here is a DIFFERENT element than the one that
		// received pointerdown -- capture is what guarantees that, and this
		// asserts the selection still completes when it does.
		tool.onPointerUp(fake_pointer_event({ clientX: 10, clientY: 10, target: upTarget as any }), ctx);

		expect([...ctx.selection.selected]).toEqual(['inside']);
		expect(downTarget.setPointerCapture).toHaveBeenCalledWith(1);
		expect(upTarget.releasePointerCapture).toHaveBeenCalledWith(1);
	});

	it('Shift-held box-select is additive to a pre-existing selection', () => {
		const already = item('already', 200, 200, 210, 210);
		const boxed = item('boxed', 2, 2, 4, 4);
		const ctx = fake_ctx([already, boxed]);
		ctx.selection.selectOnly('already');

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0, shiftKey: true }), ctx);
		tool.onPointerMove(fake_pointer_event({ clientX: 10, clientY: 10, shiftKey: true }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 10, clientY: 10 }), ctx);

		expect([...ctx.selection.selected].sort()).toEqual(['already', 'boxed']);
	});

	it('a down/up pair with negligible movement behaves as a plain deselect-click, not a box-select', () => {
		const inside = item('inside', -100, -100, 100, 100);
		const ctx = fake_ctx([inside]);
		ctx.selection.selectOnly('inside');

		tool.onPointerDown(fake_pointer_event({ clientX: 0, clientY: 0 }), ctx);
		tool.onPointerUp(fake_pointer_event({ clientX: 1, clientY: 1 }), ctx);

		// The tentative clear from pointerdown stands; no box-select ran despite the box
		// technically overlapping `inside`.
		expect(ctx.selection.isEmpty).toBe(true);
	});
});

describe('SelectTool.onActivate / onDeactivate', () => {
	it('reset all transient gesture state', () => {
		const a = item('a', 0, 0, 10, 10);
		const ctx = fake_ctx([a]);
		ctx.hitTest.mockReturnValue({ entity: a, pointIndex: 0 });
		tool.onPointerDown(fake_pointer_event(), ctx);
		expect(tool.getCursor(ctx)).toBe('cursor-grabbing');

		tool.onDeactivate(ctx);
		expect(tool.getCursor(ctx)).toBe('cursor-default');

		tool.onActivate(ctx);
		expect(tool.box).toBeNull();
	});
});
