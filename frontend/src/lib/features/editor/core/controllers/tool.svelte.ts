import { SvelteSet } from 'svelte/reactivity';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { distance, screen_to_world } from '$lib/shared/geometry/geometry';
import { getEntityUnderCursor, getPointAndPolygonUnderCursor } from '../../logic/selection';
import { orderAndName } from '../../logic/orderer';
import { HistoryController } from './history.svelte';
import type { InstanceContainer } from '../instance-container.svelte';
import { PolygonSelectionState, pointKeysOf } from '../selection-state.svelte';
import { SelectTool } from '../tools/select-tool.svelte';
import { DrawTool } from '../tools/draw-tool.svelte';
import { PanTool } from '../tools/pan-tool.svelte';
import type { CursorStyle, Tool, ToolContext, ToolId } from '../tools/tool.type';

const POINTS_PER_VERTEBRA = 4;
const MIDDLE_MOUSE_BUTTON = 1;
/** Slightly smaller than the vertex hit radius (12px) so a click near a corner still prefers the
 * vertex over the edge, but large enough to feel forgiving now that the side band straddles each
 * edge symmetrically (in and out of the polygon body) rather than only its inward half -- see
 * `getEntityUnderCursor`'s doc comment. */
const SIDE_HIT_RADIUS_PX = 10;

/**
 * Polygon-concrete orchestrator: composes the tools + a `PolygonSelectionState` +
 * `HistoryController`, owns tool-switching, and is the single pointer-dispatch entry point.
 * Deliberately not generic itself -- the app has exactly one entity type today. `SelectTool` is
 * now Polygon-concrete too (side/point selection is inherently vertebra-shaped); `DrawTool`/
 * `PanTool` remain generic since they never touch points/sides at all.
 */
export class ToolController {
	activeToolId = $state<ToolId>('select');
	selection = new PolygonSelectionState();
	history: HistoryController;

	private selectTool = new SelectTool();
	private drawTool = new DrawTool<Polygon>(POINTS_PER_VERTEBRA);
	private panTool = new PanTool<Polygon>();
	private tools: Record<ToolId, Tool<Polygon>>;

	get activeTool(): Tool<Polygon> {
		return this.tools[this.activeToolId];
	}

	cursor: CursorStyle = $derived.by(() => {
		if (this.parent.nav.isDragging) return 'cursor-grabbing';
		return this.activeTool.getCursor(this.buildContext());
	});

	get draftPoints(): Point[] {
		return this.drawTool.draftPoints;
	}

	get selectionBox(): { start: Point; current: Point } | null {
		return this.selectTool.box;
	}

	constructor(private parent: InstanceContainer) {
		this.history = new HistoryController(this.parent.projection, this.parent.session);
		this.tools = { select: this.selectTool, draw: this.drawTool, pan: this.panTool };
	}

	/** Explicit, user-initiated tool switch (toolbar buttons) -- always clears the selection. */
	setActiveTool(id: ToolId): void {
		this.switchTool(id, { clearSelection: true });
	}

	/**
	 * Switches the active tool. `clearSelection: false` is used for the internal
	 * draw-commit -> select handoff (`ToolContext.requestToolSwitch`), which deliberately wants
	 * the just-drawn entity's selection to survive the switch -- mirrors the pre-refactor
	 * `EditController.commit()`, which set `this.mode = 'default'` directly instead of going
	 * through `setMode()` for exactly this reason.
	 */
	private switchTool(id: ToolId, opts: { clearSelection: boolean }): void {
		if (id === this.activeToolId) return;

		const ctx = this.buildContext();
		this.tools[this.activeToolId].onDeactivate(ctx);
		if (opts.clearSelection) this.selection.clear();
		this.activeToolId = id;
		this.tools[id].onActivate(ctx);
	}

	handlePointerDown(e: PointerEvent): void {
		// Middle-mouse-button always pans, regardless of the active tool -- intercepted here so
		// individual tools never have to special-case buttons themselves.
		if (e.button === MIDDLE_MOUSE_BUTTON) {
			this.parent.nav.beginDrag(e);
			return;
		}

		// Central-line control points are hit-tested alongside ordinary vertices, but only
		// while selecting -- dragging a plate midpoint (Mode 1) is a distinct gesture from
		// ordinary vertex/box-select interaction, handled entirely by `CentralLineController`
		// when hit. Whichever is actually nearer to the cursor wins: a control point can sit
		// close to its own endplate's corners at small vertebra sizes/low zoom, and a plain
		// vertex click should never be stolen by a farther-away control point.
		if (this.activeToolId === 'select') {
			const worldPoint = this.worldPointFromEvent(e);
			const centralHit = this.parent.centralLine.hitTest(worldPoint);
			if (centralHit) {
				const centralDist = distance(centralHit.controlPoint.point, worldPoint);
				const nearestVertexDist = this.nearestVertexDistance(worldPoint);
				if (nearestVertexDist === null || centralDist < nearestVertexDist) {
					this.parent.centralLine.beginDrag(e, centralHit);
					return;
				}
			}
		}

		this.activeTool.onPointerDown(e, this.buildContext());
	}

	handlePointerMove(e: PointerEvent): void {
		if (this.parent.nav.isDragging) {
			this.parent.nav.updateDrag(e);
			return;
		}

		if (this.parent.centralLine.isDragging) {
			this.parent.centralLine.updateDrag(this.worldPointFromEvent(e));
			return;
		}

		this.activeTool.onPointerMove(e, this.buildContext());
	}

	handlePointerUp(e: PointerEvent): void {
		if (this.parent.nav.isDragging) {
			this.parent.nav.endDrag(e);
			return;
		}

		if (this.parent.centralLine.isDragging) {
			this.parent.centralLine.endDrag(e);
			return;
		}

		this.activeTool.onPointerUp(e, this.buildContext());
	}

	/** If any part of a vertebra is selected -- itself, a side, or a single point -- Delete
	 * removes the entire vertebra. No partial-polygon deletion. */
	deleteSelected = (): void => {
		if (this.selection.isEmpty) return;

		this.history.push();

		const touchedUuids = new SvelteSet(this.selection.all.map((entry) => entry.polygonUuid));

		const { projection } = this.parent;
		this.parent.session.projections[projection].polygons = orderAndName(
			this.parent.session.projections[projection].polygons.filter((p) => !touchedUuids.has(p.uuid))
		);

		this.selection.clear();
		this.parent.session.requestSave();
	};

	/** Arrow-key nudge: translates every point referenced by the current selection (at whatever
	 * mix of vertebra/side/point granularity) by `(dx, dy)` world units. One history entry per
	 * keypress, not coalesced -- matches `deleteSelected`'s one-push-per-discrete-action
	 * convention. No-op with an empty selection. */
	nudgeSelected = (dx: number, dy: number): void => {
		if (this.selection.isEmpty) return;

		this.history.push();

		const { projection } = this.parent;
		const polygons = this.parent.session.projections[projection].polygons;
		const keys = pointKeysOf(this.selection.all);

		for (const { polygonUuid, pointIndex } of keys) {
			const poly = polygons.find((p) => p.uuid === polygonUuid);
			if (!poly) continue;
			const p = poly.points[pointIndex];
			poly.points[pointIndex] = { x: p.x + dx, y: p.y + dy };
		}

		this.parent.session.projections[projection].polygons = orderAndName(polygons);
		this.parent.session.requestSave();
	};

	clear(): void {
		const { projection } = this.parent;

		this.setActiveTool('select');
		this.history.clear();

		this.parent.session.projections[projection].polygons = [];
		this.parent.session.requestSave();

		this.selection.clear();
	}

	private worldPointFromEvent(e: PointerEvent): Point {
		const { nav } = this.parent;
		const rect = this.parent.mainCanvas!.getBoundingClientRect();
		const clientXY = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		return screen_to_world(clientXY, nav.view.offset, nav.view.scale);
	}

	/** Distance to whichever vertex `SelectTool`'s own hit-testing would grab, or null if none
	 * is within its hit radius -- used to resolve priority against central-line control points. */
	private nearestVertexDistance(worldPoint: Point): number | null {
		const { projection, nav } = this.parent;
		const worldHitRadius = 12 / nav.view.scale;
		const hit = getPointAndPolygonUnderCursor(
			worldPoint,
			this.parent.session.projections[projection].polygons,
			worldHitRadius
		);
		return hit.point ? distance(hit.point, worldPoint) : null;
	}

	private buildContext(): ToolContext<Polygon> {
		const { projection, nav } = this.parent;

		return {
			entities: this.parent.session.projections[projection].polygons,
			setEntities: (next) => {
				this.parent.session.projections[projection].polygons = next;
			},
			selection: this.selection,
			history: this.history,
			viewport: this.parent.nav,
			worldPointFromEvent: (e) => this.worldPointFromEvent(e),
			hitTestEntity: (worldPoint) => {
				const worldHitRadius = 12 / nav.view.scale;
				const worldSideHitRadius = SIDE_HIT_RADIUS_PX / nav.view.scale;
				return getEntityUnderCursor(
					worldPoint,
					this.parent.session.projections[projection].polygons,
					worldHitRadius,
					worldSideHitRadius
				);
			},
			createEntity: (points) => ({ uuid: crypto.randomUUID(), id: '', points: [...points] }),
			setEntityPoint: (poly, i, p) => {
				poly.points[i] = { ...p };
			},
			reorder: orderAndName,
			requestSave: () => this.parent.session.requestSave(),
			requestToolSwitch: (id) => this.switchTool(id, { clearSelection: false })
		};
	}
}
