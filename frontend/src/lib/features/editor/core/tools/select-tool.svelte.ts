import type { Point } from '$lib/shared/geometry/geometry.type';
import { aabb_of_points, aabb_overlaps, distance } from '$lib/shared/geometry/geometry';
import type { CursorStyle, Tool, ToolContext } from './tool.type';

/** Screen-space pixels the pointer must move before a box-select counts as a drag, not a click. */
const BOX_DRAG_THRESHOLD_PX = 4;

/**
 * Click / Ctrl+click / Shift+click / box-select, plus vertex-dragging on an already-hit point.
 * Entity-shape-agnostic: all point/bounds access goes through the injected `ToolContext`
 * callbacks (`hitTest`, `boundsOf`, `setEntityPoint`).
 */
export class SelectTool<TEntity extends { uuid: string }> implements Tool<TEntity> {
	readonly id = 'select' as const;

	private draggingEntity = $state<TEntity | null>(null);
	private dragPointIndex = $state<number | null>(null);

	private boxStart = $state<Point | null>(null);
	private boxCurrent = $state<Point | null>(null);
	private boxAdditive = false;
	private downClientXY: Point | null = null;

	readonly box = $derived.by(() => {
		if (!this.boxStart || !this.boxCurrent) return null;
		return { start: this.boxStart, current: this.boxCurrent };
	});

	getCursor(_ctx: ToolContext<TEntity>): CursorStyle {
		return this.dragPointIndex !== null ? 'cursor-grabbing' : 'cursor-default';
	}

	onActivate(_ctx: ToolContext<TEntity>): void {
		this.resetTransientState();
	}

	onDeactivate(_ctx: ToolContext<TEntity>): void {
		this.resetTransientState();
	}

	private resetTransientState(): void {
		this.draggingEntity = null;
		this.dragPointIndex = null;
		this.boxStart = null;
		this.boxCurrent = null;
		this.boxAdditive = false;
		this.downClientXY = null;
	}

	onPointerDown(e: PointerEvent, ctx: ToolContext<TEntity>): void {
		const worldPoint = ctx.worldPointFromEvent(e);
		const hit = ctx.hitTest(worldPoint);

		if (hit.entity && hit.pointIndex !== null) {
			// Vertex hit: always starts a drag and replace-selects the owning entity, ignoring
			// modifiers -- matches the pre-refactor behavior of clicking directly on a vertex.
			this.draggingEntity = hit.entity;
			this.dragPointIndex = hit.pointIndex;
			ctx.selection.selectOnly(hit.entity.uuid);
			ctx.history.push();

			if (e.target instanceof Element) {
				e.target.setPointerCapture(e.pointerId);
			}
			return;
		}

		if (hit.entity) {
			// Body hit (no vertex): modifier-dependent click-select, no drag.
			if (e.ctrlKey || e.metaKey) {
				ctx.selection.toggle(hit.entity.uuid);
			} else if (e.shiftKey) {
				ctx.selection.selectRange(
					ctx.entities.map((entity) => entity.uuid),
					hit.entity.uuid
				);
			} else {
				ctx.selection.selectOnly(hit.entity.uuid);
			}
			return;
		}

		// Miss: start tracking a possible box-select. If no modifier is held, tentatively clear
		// the selection now -- correct final state if this turns out to be a plain empty-space
		// click rather than a real drag.
		this.boxStart = worldPoint;
		this.boxCurrent = worldPoint;
		this.downClientXY = { x: e.clientX, y: e.clientY };
		this.boxAdditive = e.shiftKey;

		if (!e.shiftKey && !(e.ctrlKey || e.metaKey)) {
			ctx.selection.clear();
		}

		// Without capturing the pointer, a drag that ends over a different
		// element sharing the same screen space (e.g. the minimap, absolutely
		// positioned over the main canvas's corner) delivers pointerup to
		// THAT element instead -- the main canvas's onPointerUp never fires,
		// leaving the box stuck forever. Capturing keeps the whole gesture
		// bound to whatever element received pointerdown, regardless of
		// what's visually underneath the cursor when it's released.
		if (e.target instanceof Element) {
			e.target.setPointerCapture(e.pointerId);
		}
	}

	onPointerMove(e: PointerEvent, ctx: ToolContext<TEntity>): void {
		if (this.dragPointIndex !== null && this.draggingEntity) {
			ctx.setEntityPoint(this.draggingEntity, this.dragPointIndex, ctx.worldPointFromEvent(e));
			return;
		}

		if (this.boxStart) {
			this.boxCurrent = ctx.worldPointFromEvent(e);
		}
	}

	onPointerUp(e: PointerEvent, ctx: ToolContext<TEntity>): void {
		if (this.dragPointIndex !== null) {
			if (e.target instanceof Element) {
				e.target.releasePointerCapture(e.pointerId);
			}

			ctx.setEntities(ctx.reorder(ctx.entities));
			ctx.requestSave();
			this.draggingEntity = null;
			this.dragPointIndex = null;
			return;
		}

		if (this.boxStart && this.boxCurrent && this.downClientXY) {
			if (e.target instanceof Element) {
				e.target.releasePointerCapture(e.pointerId);
			}

			const moved =
				distance({ x: e.clientX, y: e.clientY }, this.downClientXY) > BOX_DRAG_THRESHOLD_PX;

			if (moved) {
				const box = aabb_of_points([this.boxStart, this.boxCurrent]);
				const hits = ctx.entities
					.filter((entity) => aabb_overlaps(ctx.boundsOf(entity), box))
					.map((entity) => entity.uuid);

				if (this.boxAdditive) {
					ctx.selection.addAll(hits);
				} else {
					ctx.selection.replaceWith(hits);
				}
			}
		}

		this.boxStart = null;
		this.boxCurrent = null;
		this.boxAdditive = false;
		this.downClientXY = null;
	}
}
