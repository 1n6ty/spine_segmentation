import { describe, it, expect, vi } from 'vitest';
import { DrawTool } from './draw-tool.svelte';
import { SelectionState } from '../selection-state.svelte';
import type { ToolContext } from './tool.type';

type Item = { uuid: string };

function fake_ctx(overrides: Partial<ToolContext<Item>> = {}): ToolContext<Item> {
	return {
		entities: [],
		setEntities: vi.fn(),
		selection: new SelectionState<Item>(),
		history: { push: vi.fn() } as unknown as ToolContext<Item>['history'],
		viewport: { isDragging: false, beginDrag: vi.fn(), updateDrag: vi.fn(), endDrag: vi.fn() },
		worldPointFromEvent: (e) => ({ x: (e as any).clientX, y: (e as any).clientY }),
		hitTest: vi.fn(),
		boundsOf: vi.fn(),
		createEntity: vi.fn((points) => ({ uuid: 'new-uuid', points })) as any,
		setEntityPoint: vi.fn(),
		reorder: (entities) => entities,
		requestSave: vi.fn(),
		requestToolSwitch: vi.fn(),
		...overrides
	};
}

function fake_pointer_event(x: number, y: number): PointerEvent {
	return { clientX: x, clientY: y, pointerId: 1 } as unknown as PointerEvent;
}

describe('DrawTool.addPoint / commit', () => {
	it('accumulates draft points without committing until pointsPerEntity is reached', () => {
		const tool = new DrawTool<Item>(4);
		const ctx = fake_ctx();

		tool.onPointerDown(fake_pointer_event(0, 0), ctx);
		tool.onPointerDown(fake_pointer_event(0, 10), ctx);
		tool.onPointerDown(fake_pointer_event(10, 10), ctx);

		expect(tool.draftPoints).toHaveLength(3);
		expect(ctx.setEntities).not.toHaveBeenCalled();
	});

	it('commits a new entity on the Nth point and resets draft state', () => {
		const setEntities = vi.fn();
		const requestToolSwitch = vi.fn();
		const tool = new DrawTool<Item>(4);
		const ctx = fake_ctx({ setEntities, requestToolSwitch });

		tool.onPointerDown(fake_pointer_event(0, 0), ctx);
		tool.onPointerDown(fake_pointer_event(0, 10), ctx);
		tool.onPointerDown(fake_pointer_event(10, 10), ctx);
		tool.onPointerDown(fake_pointer_event(10, 0), ctx);

		expect(setEntities).toHaveBeenCalledTimes(1);
		expect(setEntities.mock.calls[0][0]).toEqual([{ uuid: 'new-uuid', points: expect.any(Array) }]);
		expect(tool.draftPoints).toEqual([]);
		expect(ctx.selection.has('new-uuid')).toBe(true);
		expect(requestToolSwitch).toHaveBeenCalledWith('select');
	});

	it('pushes exactly one history snapshot per commit', () => {
		const push = vi.fn();
		const tool = new DrawTool<Item>(4);
		const ctx = fake_ctx({ history: { push } as unknown as ToolContext<Item>['history'] });

		tool.onPointerDown(fake_pointer_event(0, 0), ctx);
		tool.onPointerDown(fake_pointer_event(0, 10), ctx);
		tool.onPointerDown(fake_pointer_event(10, 10), ctx);
		tool.onPointerDown(fake_pointer_event(10, 0), ctx);

		expect(push).toHaveBeenCalledTimes(1);
	});

	it('calls requestSave on commit', () => {
		const requestSave = vi.fn();
		const tool = new DrawTool<Item>(4);
		const ctx = fake_ctx({ requestSave });

		tool.onPointerDown(fake_pointer_event(0, 0), ctx);
		tool.onPointerDown(fake_pointer_event(0, 10), ctx);
		tool.onPointerDown(fake_pointer_event(10, 10), ctx);
		tool.onPointerDown(fake_pointer_event(10, 0), ctx);

		expect(requestSave).toHaveBeenCalled();
	});

	it('the point count is a constructor param, not hardcoded to 4', () => {
		const setEntities = vi.fn();
		const tool = new DrawTool<Item>(3);
		const ctx = fake_ctx({ setEntities });

		tool.onPointerDown(fake_pointer_event(0, 0), ctx);
		tool.onPointerDown(fake_pointer_event(0, 10), ctx);
		expect(setEntities).not.toHaveBeenCalled();

		tool.onPointerDown(fake_pointer_event(10, 10), ctx);
		expect(setEntities).toHaveBeenCalledTimes(1);
	});
});

describe('DrawTool.onActivate / onDeactivate', () => {
	it('reset draft points', () => {
		const tool = new DrawTool<Item>(4);
		const ctx = fake_ctx();

		tool.onPointerDown(fake_pointer_event(0, 0), ctx);
		expect(tool.draftPoints).toHaveLength(1);

		tool.onDeactivate(ctx);
		expect(tool.draftPoints).toEqual([]);

		tool.onPointerDown(fake_pointer_event(0, 0), ctx);
		tool.onActivate(ctx);
		expect(tool.draftPoints).toEqual([]);
	});
});

describe('DrawTool.getCursor', () => {
	it('is always crosshair', () => {
		const tool = new DrawTool<Item>(4);
		expect(tool.getCursor(fake_ctx())).toBe('cursor-crosshair');
	});
});
