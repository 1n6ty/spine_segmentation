import type { AABB, Point } from '$lib/shared/geometry/geometry.type';
import type { SelectionState } from '../selection-state.svelte';
import type { HistoryController } from '../controllers/history.svelte';

export type ToolId = 'select' | 'draw' | 'pan';
export type CursorStyle = 'cursor-grab' | 'cursor-grabbing' | 'cursor-crosshair' | 'cursor-default';

export interface HitResult<TEntity> {
	entity: TEntity | null;
	/** Non-null only for entity kinds that expose sub-point hit-testing (e.g. polygon vertices). */
	pointIndex: number | null;
}

/** The subset of viewport-drag behavior a tool needs, without depending on ViewportController itself. */
export interface PanViewport {
	readonly isDragging: boolean;
	beginDrag(e: PointerEvent): void;
	updateDrag(e: PointerEvent): void;
	endDrag(e: PointerEvent): void;
}

/**
 * Everything a `Tool` needs to operate, injected by the orchestrating controller. The four
 * point-aware callbacks (`hitTest`, `boundsOf`, `createEntity`, `setEntityPoint`) are the only
 * place "this entity has points" leaks into the otherwise entity-shape-agnostic tool machinery.
 */
export interface ToolContext<TEntity extends { uuid: string }> {
	readonly entities: TEntity[];
	setEntities(next: TEntity[]): void;
	readonly selection: SelectionState<TEntity>;
	readonly history: HistoryController;
	readonly viewport: PanViewport;
	worldPointFromEvent(e: PointerEvent): Point;
	hitTest(worldPoint: Point): HitResult<TEntity>;
	boundsOf(entity: TEntity): AABB;
	createEntity(points: Point[]): TEntity;
	setEntityPoint(entity: TEntity, pointIndex: number, worldPoint: Point): void;
	reorder(entities: TEntity[]): TEntity[];
	requestSave(): void;
	requestToolSwitch(id: ToolId): void;
}

export interface Tool<TEntity extends { uuid: string }> {
	readonly id: ToolId;
	getCursor(ctx: ToolContext<TEntity>): CursorStyle;
	onActivate(ctx: ToolContext<TEntity>): void;
	onDeactivate(ctx: ToolContext<TEntity>): void;
	onPointerDown(e: PointerEvent, ctx: ToolContext<TEntity>): void;
	onPointerMove(e: PointerEvent, ctx: ToolContext<TEntity>): void;
	onPointerUp(e: PointerEvent, ctx: ToolContext<TEntity>): void;
}
