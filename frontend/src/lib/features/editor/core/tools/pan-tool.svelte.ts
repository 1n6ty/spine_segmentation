import type { CursorStyle, Tool, ToolContext } from './tool.type';

/**
 * Pans the viewport on left-drag. Never touches entities or selection at all -- proof that the
 * `Tool` interface doesn't leak any Polygon/vertebra assumptions.
 */
export class PanTool<TEntity extends { uuid: string }> implements Tool<TEntity> {
	readonly id = 'pan' as const;

	getCursor(ctx: ToolContext<TEntity>): CursorStyle {
		return ctx.viewport.isDragging ? 'cursor-grabbing' : 'cursor-grab';
	}

	onActivate(_ctx: ToolContext<TEntity>): void {}
	onDeactivate(_ctx: ToolContext<TEntity>): void {}

	onPointerDown(e: PointerEvent, ctx: ToolContext<TEntity>): void {
		ctx.viewport.beginDrag(e);
	}

	onPointerMove(_e: PointerEvent, _ctx: ToolContext<TEntity>): void {}
	onPointerUp(_e: PointerEvent, _ctx: ToolContext<TEntity>): void {}
}
