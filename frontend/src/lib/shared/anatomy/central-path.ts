import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { get_midpoint } from '$lib/shared/geometry/geometry';
import {
	fitArcLengthSpline2D,
	type ArcLengthSpline2D
} from '$lib/shared/geometry/arc-length-spline-2d';

export type Plate = 'bottom' | 'top';

/** Which two indices into a vertebra's `points` form each endplate -- see `orderer.ts`. */
const PLATE_CORNER_INDICES: Record<Plate, [number, number]> = {
	bottom: [0, 3],
	top: [1, 2]
};

export interface CentralLineControlPoint {
	vertebraIndex: number;
	plate: Plate;
	point: Point;
	cornerIndices: [number, number];
}

export interface CentralPath {
	controlPoints: CentralLineControlPoint[];
	spline: ArcLengthSpline2D;
	samplePoints(samplesPerSegment?: number): Point[];
}

/**
 * Computes the spine central line through every vertebra's endplate midpoints -- the frontend
 * counterpart of the backend's `compute_spine_central_path`
 * (`Dicom/utils/segmentation/utils.py`), which is never serialized to the API and so has no
 * wire-format ground truth to match; this is a from-scratch derived overlay, recomputed from
 * `polygons` on every call. `polygons` is assumed already spine-ordered (S1 -> C2), which
 * `orderAndName()` guarantees.
 *
 * Includes every vertebra's bottom and top plate midpoint, including the spine's outermost
 * points (S1's true bottom plate and C2's true top plate) -- callers that need "the true
 * outermost plate specifically" no longer need `getPlateMidpoint`'s workaround, though it's
 * kept for callers that only have a single polygon in hand.
 */
export function computeCentralPath(polygons: Polygon[]): CentralPath | null {
	if (polygons.length === 0) return null;

	const controlPoints: CentralLineControlPoint[] = [];
	polygons.forEach((poly, vertebraIndex) => {
		if (poly.points.length !== 4) return;

		(['bottom', 'top'] as const).forEach((plate) => {
			const [i0, i1] = PLATE_CORNER_INDICES[plate];
			controlPoints.push({
				vertebraIndex,
				plate,
				point: get_midpoint(poly.points[i0], poly.points[i1]),
				cornerIndices: [i0, i1]
			});
		});
	});

	if (controlPoints.length < 2) return null;

	const spline = fitArcLengthSpline2D(controlPoints.map((cp) => cp.point));

	return {
		controlPoints,
		spline,
		samplePoints(samplesPerSegment = 16): Point[] {
			const { t } = spline;
			const points: Point[] = [];

			for (let i = 0; i < t.length - 1; i++) {
				for (let s = 0; s < samplesPerSegment; s++) {
					const u = t[i] + ((t[i + 1] - t[i]) * s) / samplesPerSegment;
					points.push(spline.evaluate(u));
				}
			}
			points.push(spline.evaluate(t[t.length - 1]));

			return points;
		}
	};
}

/**
 * A vertebra's own plate midpoint, computed directly from its polygon corners --
 * independent of `computeCentralPath`'s `controlPoints`, which deliberately drop the
 * spine's two outermost plate points (see `computeCentralPath`'s doc comment). Callers
 * needing "the top/bottom of vertebra N specifically" (e.g. a range-selection handle
 * that must be able to land on the true inferior-most or superior-most vertebra) should
 * use this rather than searching `controlPoints`, which may not contain that plate at all.
 */
export function getPlateMidpoint(polygon: Polygon, plate: Plate): Point {
	const [i0, i1] = PLATE_CORNER_INDICES[plate];
	return get_midpoint(polygon.points[i0], polygon.points[i1]);
}
