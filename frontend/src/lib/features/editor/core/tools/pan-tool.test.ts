import { describe, it, expect, vi } from 'vitest';
import { PanTool } from './pan-tool.svelte';
import type { PanViewport, ToolContext } from './tool.type';

type Item = { uuid: string };

function fake_ctx(viewport: Partial<PanViewport> = {}): ToolContext<Item> {
	return {
		entities: [],
		setEntities: vi.fn(),
		selection: {} as ToolContext<Item>['selection'],
		history: {} as ToolContext<Item>['history'],
		viewport: {
			isDragging: false,
			beginDrag: vi.fn(),
			updateDrag: vi.fn(),
			endDrag: vi.fn(),
			...viewport
		},
		worldPointFromEvent: vi.fn(),
		hitTest: vi.fn(),
		boundsOf: vi.fn(),
		createEntity: vi.fn(),
		setEntityPoint: vi.fn(),
		reorder: vi.fn(),
		requestSave: vi.fn(),
		requestToolSwitch: vi.fn()
	};
}

function fake_pointer_event(): PointerEvent {
	return { clientX: 0, clientY: 0, pointerId: 1 } as unknown as PointerEvent;
}

describe('PanTool', () => {
	it('starts a viewport drag on pointer down', () => {
		const tool = new PanTool<Item>();
		const ctx = fake_ctx();

		tool.onPointerDown(fake_pointer_event(), ctx);

		expect(ctx.viewport.beginDrag).toHaveBeenCalledWith(expect.anything());
	});

	it('cursor reflects the viewport dragging state', () => {
		const tool = new PanTool<Item>();

		expect(tool.getCursor(fake_ctx({ isDragging: false }))).toBe('cursor-grab');
		expect(tool.getCursor(fake_ctx({ isDragging: true }))).toBe('cursor-grabbing');
	});

	it('never touches entities or selection', () => {
		const tool = new PanTool<Item>();
		const ctx = fake_ctx();

		tool.onPointerDown(fake_pointer_event(), ctx);
		tool.onPointerMove(fake_pointer_event(), ctx);
		tool.onPointerUp(fake_pointer_event(), ctx);

		expect(ctx.setEntities).not.toHaveBeenCalled();
	});

	it('onActivate / onDeactivate are no-ops', () => {
		const tool = new PanTool<Item>();
		const ctx = fake_ctx();

		expect(() => tool.onActivate(ctx)).not.toThrow();
		expect(() => tool.onDeactivate(ctx)).not.toThrow();
	});
});
