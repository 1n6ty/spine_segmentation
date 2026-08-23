import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { distance } from '$lib/shared/geometry/geometry';
import { classifyRectSelection } from '../../logic/selection';
import { pointKeysOf, type SelectionEntry } from '../selection-state.svelte';
import type { CursorStyle, Tool, ToolContext } from './tool.type';

/** Screen-space pixels the pointer must move before a gesture counts as a drag, not a click --
 * shared by box-select and the group/entity drag below. */
const DRAG_THRESHOLD_PX = 4;

/**
 * Click / Ctrl+click / Shift+click / box-select, plus dragging the current selection (whatever
 * mix of whole vertebrae, sides, and points it holds) as one rigid group. Polygon-concrete (not
 * generic like the tool it replaces) -- side/point selection only makes sense for the fixed
 * 4-point vertebra shape `orderer.ts` enforces, so genericity here would be pretend-abstraction
 * over an entity shape that never varies in practice.
 */
export class SelectTool implements Tool<Polygon> {
	readonly id = 'select' as const;

	// Entity/group-drag state. `dragKeys` being non-null means a drag was armed on pointerdown;
	// `dragConfirmed` flips true the first time movement crosses DRAG_THRESHOLD_PX.
	private dragKeys: { polygonUuid: string; pointIndex: number }[] | null = null;
	private dragBasePoints = new SvelteMap<string, Point>();
	private dragStartWorld: Point | null = null;
	private dragConfirmed = false;
	// Set only when the hit entity was ALREADY selected on pointerdown -- the click-vs-drag
	// decision for it is deferred to pointerup (see onPointerDown's comment).
	private pendingClickEntry: SelectionEntry | null = null;

	private boxStart = $state<Point | null>(null);
	private boxCurrent = $state<Point | null>(null);
	private boxShift = false;
	private boxCtrl = false;
	private downClientXY: Point | null = null;

	readonly box = $derived.by(() => {
		if (!this.boxStart || !this.boxCurrent) return null;
		return { start: this.boxStart, current: this.boxCurrent };
	});

	getCursor(_ctx: ToolContext<Polygon>): CursorStyle {
		return this.dragKeys !== null ? 'cursor-grabbing' : 'cursor-default';
	}

	onActivate(_ctx: ToolContext<Polygon>): void {
		this.resetTransientState();
	}

	onDeactivate(_ctx: ToolContext<Polygon>): void {
		this.resetTransientState();
	}

	private resetTransientState(): void {
		this.dragKeys = null;
		this.dragBasePoints.clear();
		this.dragStartWorld = null;
		this.dragConfirmed = false;
		this.pendingClickEntry = null;
		this.boxStart = null;
		this.boxCurrent = null;
		this.boxShift = false;
		this.boxCtrl = false;
		this.downClientXY = null;
	}

	onPointerDown(e: PointerEvent, ctx: ToolContext<Polygon>): void {
		const worldPoint = ctx.worldPointFromEvent(e);
		const hit = ctx.hitTestEntity(worldPoint);

		if (hit === null) {
			// Miss: start tracking a possible box-select. If no modifier is held, tentatively
			// clear the selection now -- correct final state if this turns out to be a plain
			// empty-space click rather than a real drag.
			this.boxStart = worldPoint;
			this.boxCurrent = worldPoint;
			this.downClientXY = { x: e.clientX, y: e.clientY };
			this.boxShift = e.shiftKey;
			this.boxCtrl = e.ctrlKey || e.metaKey;

			if (!e.shiftKey && !(e.ctrlKey || e.metaKey)) {
				ctx.selection.clear();
			}

			// Without capturing the pointer, a drag that ends over a different element sharing
			// the same screen space (e.g. the minimap, absolutely positioned over the main
			// canvas's corner) delivers pointerup to THAT element instead. Capturing keeps the
			// whole gesture bound to whatever element received pointerdown.
			if (e.target instanceof Element) {
				e.target.setPointerCapture(e.pointerId);
			}
			return;
		}

		if (e.ctrlKey || e.metaKey) {
			// Ctrl/Cmd+click: agnostic toggle-add, no drag -- matches the pre-refactor body-hit
			// behavior, now applying at any granularity.
			ctx.selection.toggleOne(hit);
			return;
		}

		if (e.shiftKey) {
			// Shift+click: point-array range select, no drag.
			ctx.selection.selectPointRangeByVertebra(
				ctx.entities.map((entity) => entity.uuid),
				hit
			);
			return;
		}

		// Plain click on a hit: arms a potential drag. Whether it resolves as a click (deselect
		// the sole selection, or replace it) or a real group-drag is decided by whether the
		// pointer moves past DRAG_THRESHOLD_PX before release -- see onPointerMove/onPointerUp.
		if (ctx.selection.has(hit)) {
			// Already selected: don't mutate the selection yet -- if this turns into a drag, the
			// WHOLE current selection (not just the clicked entity) should move together. If it
			// stays a click, onPointerUp resolves it via `pendingClickEntry`.
			this.pendingClickEntry = hit;
			this.dragKeys = pointKeysOf(ctx.selection.all);
		} else {
			// Not selected: replace the selection with just this entity immediately, matching
			// the existing "select-then-drag" feel of a fresh vertex drag.
			ctx.selection.selectOnly(hit);
			this.pendingClickEntry = null;
			this.dragKeys = pointKeysOf([hit]);
		}

		this.dragBasePoints.clear();
		for (const { polygonUuid, pointIndex } of this.dragKeys) {
			const poly = ctx.entities.find((p) => p.uuid === polygonUuid);
			if (poly)
				this.dragBasePoints.set(`${polygonUuid}:${pointIndex}`, { ...poly.points[pointIndex] });
		}
		this.dragStartWorld = worldPoint;
		this.dragConfirmed = false;
		this.downClientXY = { x: e.clientX, y: e.clientY };

		// Pushed unconditionally here (even though the gesture may resolve as a no-op click) --
		// matches the pre-refactor vertex-drag convention of one history entry per potential-drag
		// gesture, not one per confirmed mutation.
		ctx.history.push();

		if (e.target instanceof Element) {
			e.target.setPointerCapture(e.pointerId);
		}
	}

	onPointerMove(e: PointerEvent, ctx: ToolContext<Polygon>): void {
		if (this.dragKeys && this.dragStartWorld && this.downClientXY) {
			if (!this.dragConfirmed) {
				const moved =
					distance({ x: e.clientX, y: e.clientY }, this.downClientXY) > DRAG_THRESHOLD_PX;
				if (!moved) return;
				this.dragConfirmed = true;
			}

			const worldPoint = ctx.worldPointFromEvent(e);
			const delta = {
				x: worldPoint.x - this.dragStartWorld.x,
				y: worldPoint.y - this.dragStartWorld.y
			};

			for (const { polygonUuid, pointIndex } of this.dragKeys) {
				const base = this.dragBasePoints.get(`${polygonUuid}:${pointIndex}`);
				if (!base) continue;
				const poly = ctx.entities.find((p) => p.uuid === polygonUuid);
				if (!poly) continue;
				ctx.setEntityPoint(poly, pointIndex, { x: base.x + delta.x, y: base.y + delta.y });
			}
			return;
		}

		if (this.boxStart) {
			this.boxCurrent = ctx.worldPointFromEvent(e);
		}
	}

	onPointerUp(e: PointerEvent, ctx: ToolContext<Polygon>): void {
		if (this.dragKeys) {
			if (e.target instanceof Element) {
				e.target.releasePointerCapture(e.pointerId);
			}

			if (this.dragConfirmed) {
				ctx.setEntities(ctx.reorder(ctx.entities));
				ctx.requestSave();
			} else if (this.pendingClickEntry) {
				// No movement: resolve the deferred click-on-an-already-selected-entity case.
				if (ctx.selection.isSoleSelection(this.pendingClickEntry)) {
					ctx.selection.clear();
				} else {
					ctx.selection.selectOnly(this.pendingClickEntry);
				}
			}

			this.dragKeys = null;
			this.dragBasePoints.clear();
			this.dragStartWorld = null;
			this.dragConfirmed = false;
			this.pendingClickEntry = null;
			this.downClientXY = null;
			return;
		}

		if (this.boxStart && this.boxCurrent && this.downClientXY) {
			if (e.target instanceof Element) {
				e.target.releasePointerCapture(e.pointerId);
			}

			const moved = distance({ x: e.clientX, y: e.clientY }, this.downClientXY) > DRAG_THRESHOLD_PX;

			if (moved) {
				const minX = Math.min(this.boxStart.x, this.boxCurrent.x);
				const maxX = Math.max(this.boxStart.x, this.boxCurrent.x);
				const minY = Math.min(this.boxStart.y, this.boxCurrent.y);
				const maxY = Math.max(this.boxStart.y, this.boxCurrent.y);
				const box = { minX, minY, maxX, maxY };

				const entries = classifyRectSelection(ctx.entities, box);

				if (this.boxCtrl) {
					ctx.selection.toggleMany(entries);
				} else if (this.boxShift) {
					const touchedUuids = new SvelteSet(entries.map((entry) => entry.polygonUuid));
					ctx.selection.selectPointRangeOverVertebraSet(
						ctx.entities.map((entity) => entity.uuid),
						touchedUuids,
						entries
					);
				} else {
					ctx.selection.replaceWithMany(entries);
				}
			}
		}

		this.boxStart = null;
		this.boxCurrent = null;
		this.boxShift = false;
		this.boxCtrl = false;
		this.downClientXY = null;
	}
}
