import type { Point } from '$lib/shared/geometry/geometry.type';
import type { CursorStyle, Tool, ToolContext } from './tool.type';

/**
 * Accumulates draft points and commits a new entity once `pointsPerEntity` points have been
 * placed. `pointsPerEntity` is a constructor param (not a hardcoded `4`) so the "always exactly N
 * points" assumption lives at the call site, not inside the tool.
 */
export class DrawTool<TEntity extends { uuid: string }> implements Tool<TEntity> {
	readonly id = 'draw' as const;

	draftPoints = $state<Point[]>([]);

	constructor(private pointsPerEntity: number) {}

	getCursor(_ctx: ToolContext<TEntity>): CursorStyle {
		return 'cursor-crosshair';
	}

	onActivate(_ctx: ToolContext<TEntity>): void {
		this.draftPoints = [];
	}

	onDeactivate(_ctx: ToolContext<TEntity>): void {
		this.draftPoints = [];
	}

	onPointerDown(e: PointerEvent, ctx: ToolContext<TEntity>): void {
		this.addPoint(ctx.worldPointFromEvent(e), ctx);
	}

	onPointerMove(_e: PointerEvent, _ctx: ToolContext<TEntity>): void {}
	onPointerUp(_e: PointerEvent, _ctx: ToolContext<TEntity>): void {}

	addPoint(p: Point, ctx: ToolContext<TEntity>): void {
		this.draftPoints = [...this.draftPoints, { ...p }];

		if (this.draftPoints.length === this.pointsPerEntity) {
			this.commit(ctx);
		}
	}

	private commit(ctx: ToolContext<TEntity>): void {
		ctx.history.push();

		const entity = ctx.createEntity(this.draftPoints);
		ctx.setEntities(ctx.reorder([...ctx.entities, entity]));
		ctx.requestSave();

		this.draftPoints = [];
		ctx.selection.selectOnly(entity.uuid);
		ctx.requestToolSwitch('select');
	}
}
