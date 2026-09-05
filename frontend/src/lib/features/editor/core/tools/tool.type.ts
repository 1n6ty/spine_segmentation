import type { Point } from '$lib/shared/geometry/geometry.type';
import type { PolygonSelectionState, SelectionEntry } from '../selection-state.svelte';
import type { HistoryController } from '../controllers/history.svelte';

export type ToolId = 'select' | 'draw' | 'pan';
export type CursorStyle = 'cursor-grab' | 'cursor-grabbing' | 'cursor-crosshair' | 'cursor-default';

/** The subset of viewport-drag behavior a tool needs, without depending on ViewportController itself. */
export interface PanViewport {
	readonly isDragging: boolean;
	beginDrag(e: PointerEvent): void;
	updateDrag(e: PointerEvent): void;
	endDrag(e: PointerEvent): void;
}

/**
 * Everything a `Tool` needs to operate, injected by the orchestrating controller. `selection` and
 * `hitTestEntity` are inherently Polygon/vertebra-shaped (side/point addressing depends on the
 * fixed 4-point, left=[0,1]/right=[2,3] convention `orderer.ts` enforces) -- `SelectTool` is the
 * only tool that uses either. `DrawTool`/`PanTool` stay entity-shape-agnostic through the rest of
 * this interface (`entities`, `createEntity`, `setEntityPoint`).
 */
export interface ToolContext<TEntity extends { uuid: string }> {
	readonly entities: TEntity[];
	setEntities(next: TEntity[]): void;
	readonly selection: PolygonSelectionState;
	readonly history: HistoryController;
	readonly viewport: PanViewport;
	worldPointFromEvent(e: PointerEvent): Point;
	hitTestEntity(worldPoint: Point): SelectionEntry | null;
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
