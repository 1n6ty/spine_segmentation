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
 * The spine's outermost bottom point (first vertebra's bottom plate) and outermost top point
 * (last vertebra's top plate) are dropped entirely -- they sit past the outer edge of the
 * outermost vertebra, outside the inter-vertebral alignment the central line is meant to track.
 * They're excluded from the spline fit itself (not merely hidden at render time), so the curve
 * is only ever shaped by, and only ever shown/draggable through, the remaining interior points.
 */
export function computeCentralPath(polygons: Polygon[]): CentralPath | null {
	if (polygons.length === 0) return null;

	const allPoints: CentralLineControlPoint[] = [];
	polygons.forEach((poly, vertebraIndex) => {
		if (poly.points.length !== 4) return;

		(['bottom', 'top'] as const).forEach((plate) => {
			const [i0, i1] = PLATE_CORNER_INDICES[plate];
			allPoints.push({
				vertebraIndex,
				plate,
				point: get_midpoint(poly.points[i0], poly.points[i1]),
				cornerIndices: [i0, i1]
			});
		});
	});

	const controlPoints = allPoints.length > 2 ? allPoints.slice(1, -1) : [];
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
