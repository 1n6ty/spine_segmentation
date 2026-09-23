import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import { solveCircleFit } from '$lib/shared/geometry/circle-fit';
import { getPlateMidpoint } from '$lib/shared/anatomy/central-path';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Segment, Vertebrae } from '../types';

const UP: Point = { x: 0, y: -1 };

const nullSegmentParams = (segment: Segment) => ({
	name: `${segment.at(-1)?.id}-${segment.at(0)?.id}`,
	params: {
		p1: { val: null, type: 'linear' },
		p2: { val: null, type: 'linear' },
		p3: { val: null, type: 'angular' },
		p4: { val: null, type: 'angular' }
	}
});

/**
 * `getPlateMidpoint`, but for the one anchor role (start/end) that must always resolve to a
 * single point: S1's inferior plate and C2's superior plate aren't real disc-bearing endplates
 * (S1's "bottom" is the sacral base, C2's "top" is the odontoid) -- the same exclusion
 * vertebrae.ts's p1/p2 already apply (p1 null for C2, p2 null for S1) -- so silently substitute
 * S1's superior plate / C2's inferior plate instead of the missing one. Central-path.ts's own
 * drawing (central line, minimap, etc.) is untouched -- it deliberately keeps S1's true bottom
 * and C2's true top; this substitution is scoped to segment parameters only.
 */
function segmentEndpointPlate(v: Vertebrae, plate: 'bottom' | 'top'): Point {
	if (v.id === 'S1' && plate === 'bottom') return getPlateMidpoint(v, 'top');
	if (v.id === 'C2' && plate === 'top') return getPlateMidpoint(v, 'bottom');
	return getPlateMidpoint(v, plate);
}

/**
 * Fitted to each vertebra's own bottom/top plate midpoint (2 points/vertebra), not its 4 raw
 * corners -- corners mix the anterior and posterior margins, which trace two distinct radii
 * whenever a vertebra is wedged (see vertebrae.ts's p5/p6), while plate midpoints sit on one
 * consistent central locus. This also matches start/end below, which were already plate
 * midpoints -- the whole calculation now draws from the same point family.
 *
 * S1's inferior plate and C2's superior plate are excluded outright here (not substituted --
 * substituting would push the same point twice and double-weight it in the fit): S1 only
 * contributes its superior plate, C2 only its inferior, same non-endplate reasoning as above.
 */
export const getSegmentParams = (projection: Projection, segment: Segment, mmPerPixel: number) => {
	const points: Point[] = [];
	segment.forEach((v) => {
		if (v.id !== 'S1') points.push(getPlateMidpoint(v, 'bottom'));
		if (v.id !== 'C2') points.push(getPlateMidpoint(v, 'top'));
	});

	if (points.length < 3) {
		return nullSegmentParams(segment);
	}

	// A perfectly straight segment (all plate midpoints collinear -- an exact, not just near,
	// degenerate case now that corners no longer add off-axis spread) has no finite circle
	// through it; solveCircleFit's normal-equations solve throws on the singular matrix rather
	// than returning one. Mirrors arc-segmentation.ts's fitGroupRange guard.
	let abc: [number, number, number];
	try {
		abc = solveCircleFit(points);
	} catch {
		return nullSegmentParams(segment);
	}

	const radius = M.get_arc_radius(abc);
	const center = M.get_arc_center(abc);
	if (!Number.isFinite(radius) || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
		return nullSegmentParams(segment);
	}

	const start = segmentEndpointPlate(segment[0], 'bottom');
	const end = segmentEndpointPlate(segment[segment.length - 1], 'top');
	const chord = Math.min(M.distance(start, end), 2 * radius);

	// Signed central angle: the swept angle from the chord's start to its end around the
	// actual fitted center (not the unsigned law-of-cosines acos, which discards which side
	// of the chord the arc bulges toward). Negative = bulges left, positive = bulges right —
	// matching the clinical documents' "negative = clockwise from vertical" convention, and
	// necessary for scoliosis/lordosis-direction grading (see diagnosis/rules/frontal.ts and
	// sagittal.ts, which already branch on sign and were previously fed an always-positive value).
	const signedCentralAngle = M.to_degrees(
		M.get_signed_angle(M.vector_sub(start, center), M.vector_sub(end, center))
	);

	return {
		name: `${segment.at(-1)?.id}-${segment.at(0)?.id}`,
		params: {
			p1: { val: radius * mmPerPixel, type: 'linear' },
			p2: { val: chord * mmPerPixel, type: 'linear' },
			p3: { val: signedCentralAngle, type: 'angular' },
			p4: { val: M.to_degrees(M.get_signed_angle(UP, M.vector_sub(end, start))), type: 'angular' }
		}
	};
};
