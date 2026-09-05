import type { AABB, Point, Polygon } from '$lib/shared/geometry/geometry.type';
import {
	distance,
	distance_to_segment,
	is_point_in_polygon,
	point_in_aabb
} from '$lib/shared/geometry/geometry';
import { SIDE_INDICES, type SelectionEntry, type Side } from '../core/selection-state.svelte';

const ALL_SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom'];

/**
 * Finds if a point in world coordinates is close enough to any vertex.
 * @param worldPoint The cursor position in world coordinates
 * @param polygons Completed polygons
 * @param draftPoints Points of the polygon currently being drawn
 * @param worldHitRadius The hit radius converted to world units (pixelRadius / scale)
 */
export function getPointAndPolygonUnderCursor(
	worldPoint: Point,
	polygons: Polygon[],
	worldHitRadius: number
): { point: Point | null; indexInPolygon: number | null; polygon: Polygon | null } {
	// 1. PHASE 1: Check ALL completed polygon vertices first (reverse order)
	for (let i = polygons.length - 1; i >= 0; i--) {
		const poly = polygons[i];
		for (let j = 0; j < poly.points.length; j++) {
			const p = poly.points[j];
			if (distance(p, worldPoint) < worldHitRadius) {
				return {
					point: { x: p.x, y: p.y },
					indexInPolygon: j,
					polygon: poly
				};
			}
		}
	}

	// 2. PHASE 2: If no vertex was hit anywhere, check if cursor is INSIDE a polygon body
	for (let i = polygons.length - 1; i >= 0; i--) {
		const poly = polygons[i];
		if (is_point_in_polygon(worldPoint, poly.points)) {
			return {
				point: null,
				indexInPolygon: null,
				polygon: poly
			};
		}
	}

	return {
		point: null,
		indexInPolygon: null,
		polygon: null
	};
}

/**
 * Click hit-testing at the editor's three selection granularities: vertex -> side (any of the 4
 * edges: left/right/top/bottom) -> whole vertebra body -> miss. Layered on top of the same vertex
 * phase as `getPointAndPolygonUnderCursor` (kept separate above since
 * `ToolController.nearestVertexDistance` only needs the narrow vertex-only check).
 *
 * The side phase is deliberately independent of body containment (`is_point_in_polygon`) -- it
 * checks distance to each of the 4 edge segments across every polygon FIRST, regardless of
 * whether the click landed just inside or just outside the polygon's boundary. Gating on
 * containment (as an earlier version of this function did) effectively halves the usable band to
 * only the inward half of `worldSideHitRadius`, since any click that strayed a pixel outside the
 * shape's edge -- exactly the imprecise-aim case a "click a thin edge" gesture invites -- missed
 * entirely. Checking edges independently of containment makes the band straddle the edge
 * symmetrically, in and out.
 */
export function getEntityUnderCursor(
	worldPoint: Point,
	polygons: Polygon[],
	worldHitRadius: number,
	worldSideHitRadius: number
): SelectionEntry | null {
	// Phase 1: vertex, all polygons, reverse z-order -- same priority as getPointAndPolygonUnderCursor.
	for (let i = polygons.length - 1; i >= 0; i--) {
		const poly = polygons[i];
		for (let j = 0; j < poly.points.length; j++) {
			if (distance(poly.points[j], worldPoint) < worldHitRadius) {
				return { kind: 'point', polygonUuid: poly.uuid, pointIndex: j };
			}
		}
	}

	// Phase 2: side -- first polygon (reverse z-order) with ANY edge within radius wins; among
	// that polygon's 4 edges, the nearest one is picked.
	for (let i = polygons.length - 1; i >= 0; i--) {
		const poly = polygons[i];
		if (poly.points.length !== 4) continue;

		let bestSide: Side | null = null;
		let bestDist = worldSideHitRadius;
		for (const side of ALL_SIDES) {
			const [a, b] = SIDE_INDICES[side];
			const d = distance_to_segment(worldPoint, poly.points[a], poly.points[b]);
			if (d < bestDist) {
				bestDist = d;
				bestSide = side;
			}
		}

		if (bestSide) {
			return { kind: 'side', polygonUuid: poly.uuid, side: bestSide };
		}
	}

	// Phase 3: whole-vertebra body -- first polygon (reverse z-order) containing the cursor.
	for (let i = polygons.length - 1; i >= 0; i--) {
		const poly = polygons[i];
		if (is_point_in_polygon(worldPoint, poly.points)) {
			return { kind: 'vertebra', polygonUuid: poly.uuid };
		}
	}

	return null;
}

/**
 * Rectangle (marquee) selection classification: per vertebra, which of its 4 corner points fall
 * inside `box` decides the resulting entity granularity -- all 4 -> the whole vertebra; exactly
 * one edge's 2 (and only those 2) -> that side; any other non-empty subset -> each enclosed point
 * individually, not rounded up to a side or vertebra.
 */
export function classifyRectSelection(polygons: Polygon[], box: AABB): SelectionEntry[] {
	const entries: SelectionEntry[] = [];

	for (const poly of polygons) {
		if (poly.points.length !== 4) continue;

		const enclosed = poly.points
			.map((p, i) => (point_in_aabb(p, box) ? i : -1))
			.filter((i) => i !== -1);

		if (enclosed.length === 0) continue;

		if (enclosed.length === 4) {
			entries.push({ kind: 'vertebra', polygonUuid: poly.uuid });
			continue;
		}

		const matchedSide =
			enclosed.length === 2
				? ALL_SIDES.find((side) => {
						const [a, b] = SIDE_INDICES[side];
						return enclosed.includes(a) && enclosed.includes(b);
					})
				: undefined;

		if (matchedSide) {
			entries.push({ kind: 'side', polygonUuid: poly.uuid, side: matchedSide });
		} else {
			for (const pointIndex of enclosed) {
				entries.push({ kind: 'point', polygonUuid: poly.uuid, pointIndex });
			}
		}
	}

	return entries;
}
