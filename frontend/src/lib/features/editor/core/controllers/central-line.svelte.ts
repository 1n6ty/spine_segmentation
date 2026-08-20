import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { distance, get_midpoint } from '$lib/shared/geometry/geometry';
import {
	computeCentralPath,
	type CentralLineControlPoint,
	type CentralPath
} from '../../logic/central-path';
import { orderAndName } from '../../logic/orderer';
import type { InstanceContainer } from '../instance-container.svelte';

/** Matches `ToolController`'s existing vertex hit radius. */
const HIT_RADIUS_PX = 12;

export interface CentralLineHit {
	controlPoint: CentralLineControlPoint;
	polygon: Polygon;
}

/**
 * Owns the spine central line: its derived geometry (recomputed automatically from `polygons`
 * on every mutation), and Mode 1's drag gesture (dragging a control point rigidly translates
 * its endplate's two corner points). Polygon-concrete, like `ToolController` -- lives one level
 * "above" the generic `Tool<T>` machinery since `ToolController` checks it before dispatching to
 * the active tool. Mode 2 (dragging a bare endplate corner) needs no code here at all: it's
 * already the existing free vertex-drag in `select-tool.svelte.ts`, and `centralPath` being
 * `$derived` off `polygons` means it picks up that drag's effect on its own.
 */
export class CentralLineController {
	private draggingPolygon = $state<Polygon | null>(null);
	private draggingCornerIndices = $state<[number, number] | null>(null);

	readonly centralPath: CentralPath | null = $derived.by(() =>
		computeCentralPath(this.parent.session.projections[this.parent.projection].polygons)
	);

	get isDragging(): boolean {
		return this.draggingPolygon !== null;
	}

	constructor(private parent: InstanceContainer) {}

	/** Nearest control point within hit radius, or null. `centralPath.controlPoints` already
	 * excludes the spine's outermost bottom/top points (see `computeCentralPath`). Nearest-not-
	 * first, since adjacent plates can sit close together at low zoom and first-match would pick
	 * arbitrarily. */
	hitTest(worldPoint: Point): CentralLineHit | null {
		const path = this.centralPath;
		if (!path) return null;

		const worldHitRadius = HIT_RADIUS_PX / this.parent.nav.view.scale;
		const polygons = this.parent.session.projections[this.parent.projection].polygons;

		let best: CentralLineHit | null = null;
		let bestDist = worldHitRadius;
		for (const controlPoint of path.controlPoints) {
			const d = distance(controlPoint.point, worldPoint);
			if (d < bestDist) {
				bestDist = d;
				best = { controlPoint, polygon: polygons[controlPoint.vertebraIndex] };
			}
		}

		return best;
	}

	beginDrag(e: PointerEvent, hit: CentralLineHit): void {
		this.draggingPolygon = hit.polygon;
		this.draggingCornerIndices = hit.controlPoint.cornerIndices;

		this.parent.tools.selection.selectOnly(hit.polygon.uuid);
		this.parent.tools.history.push();

		if (e.target instanceof Element) {
			e.target.setPointerCapture(e.pointerId);
		}
	}

	updateDrag(worldPoint: Point): void {
		if (!this.draggingPolygon || !this.draggingCornerIndices) return;

		const [i0, i1] = this.draggingCornerIndices;
		const points = this.draggingPolygon.points;

		// Re-derive the midpoint from the LIVE corner positions each frame (not from a
		// possibly-stale `centralPath` snapshot) -- both corners then end the frame with the
		// cursor exactly at their midpoint, translated by an identical delta, which is what
		// keeps the endplate segment's length/orientation preserved (rigid translation).
		const liveMidpoint = get_midpoint(points[i0], points[i1]);
		const delta = { x: worldPoint.x - liveMidpoint.x, y: worldPoint.y - liveMidpoint.y };

		points[i0] = { x: points[i0].x + delta.x, y: points[i0].y + delta.y };
		points[i1] = { x: points[i1].x + delta.x, y: points[i1].y + delta.y };
	}

	endDrag(e: PointerEvent): void {
		if (!this.draggingPolygon) return;

		if (e.target instanceof Element) {
			e.target.releasePointerCapture(e.pointerId);
		}

		const { projection } = this.parent;
		this.parent.session.projections[projection].polygons = orderAndName(
			this.parent.session.projections[projection].polygons
		);
		this.parent.session.requestSave();

		this.draggingPolygon = null;
		this.draggingCornerIndices = null;
	}

	clear(): void {
		this.draggingPolygon = null;
		this.draggingCornerIndices = null;
	}
}
