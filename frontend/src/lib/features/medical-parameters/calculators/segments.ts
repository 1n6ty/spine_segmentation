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

/** RMS distance from `points` to their own fitted circle, relative to `chord` -- the
 * scale-invariant "how well does this circle actually explain the data" signal `solveCircleFit`
 * itself can't provide (it always returns *a* circle, never a confidence in it). */
function relativeFitResidual(points: Point[], center: Point, radius: number, chord: number): number {
	const sq = points.reduce((acc, p) => acc + (M.distance(p, center) - radius) ** 2, 0);
	const rms = Math.sqrt(sq / points.length);
	return chord > M.EPSILON ? rms / chord : 0;
}

/**
 * Above this fraction of the chord length, the algebraic fit's own residual says it doesn't
 * meaningfully explain the points -- see `getSegmentParams`'s doc comment. Chosen from real
 * data: every genuinely-curved real segment measured against this codebase's own test patient
 * landed under 10% (0.3%-9%); a near-collinear reproduction landed at ~19.5%. Comfortably
 * between the two, closer to the good cluster's ceiling than the bad case's floor.
 */
const DEGENERATE_FIT_RESIDUAL_RATIO = 0.12;

/**
 * Reconstructs radius/center directly from the chord and the sagitta (the single most-deviating
 * point's perpendicular distance from the chord line) instead of the algebraic fit -- the
 * classical chord-sagitta relationship for a circular arc, with no matrix solve, so unlike
 * `solveCircleFit` it cannot blow up for near-collinear input: a tiny sagitta yields a huge
 * (not spuriously small) radius and a small (not near-180°) central angle once fed through the
 * same `get_signed_angle` call `getSegmentParams` already uses for the well-conditioned case --
 * same sign convention, no special-casing needed downstream. Exact for genuinely circular data
 * too (not just a degenerate-case fallback), but only uses 3 effective points (start, end, the
 * one deepest point) where the algebraic fit uses all of them, so it's the fallback, not the
 * default, whenever the algebraic fit's own residual says it's trustworthy.
 */
function fitFromSagitta(points: Point[], start: Point, end: Point): { radius: number; center: Point } {
	const mid = M.get_midpoint(start, end);
	const chordVec = M.vector_sub(end, start);
	const chordLen = M.distance(start, end);
	const nHat =
		chordLen > M.EPSILON
			? { x: -chordVec.y / chordLen, y: chordVec.x / chordLen }
			: { x: 0, y: 1 };

	let sagitta = 0;
	for (const p of points) {
		const dev = M.dot_product(M.vector_sub(p, mid), nHat);
		if (Math.abs(dev) > Math.abs(sagitta)) sagitta = dev;
	}

	if (Math.abs(sagitta) < M.EPSILON) {
		// Genuinely straight to the precision of the data: no finite circle fits it, but a huge
		// radius held far off in the chord's normal direction gives the correct near-0° central
		// angle once run through get_signed_angle, which a null/NaN radius could not.
		const radius = 1e9;
		return { radius, center: { x: mid.x - nHat.x * radius, y: mid.y - nHat.y * radius } };
	}

	const radius = (chordLen ** 2 / 4 + sagitta ** 2) / (2 * Math.abs(sagitta));
	const towardArc = sagitta >= 0 ? nHat : { x: -nHat.x, y: -nHat.y };
	return {
		radius,
		center: {
			x: mid.x - towardArc.x * (radius - Math.abs(sagitta)),
			y: mid.y - towardArc.y * (radius - Math.abs(sagitta))
		}
	};
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
 *
 * The algebraic (Kåsa) fit `solveCircleFit` runs is well-conditioned for real curvature but
 * numerically unstable for near-collinear points -- a well-documented weakness of the algebraic
 * method, not specific to this codebase: it can converge to a spuriously *small*-radius circle
 * instead of the correct huge one, which then reports a central angle near ±180° for a segment
 * that's actually nearly straight (should read near 0°). `relativeFitResidual` catches this by
 * checking how far the fitted circle actually sits from the points that were supposed to define
 * it; past `DEGENERATE_FIT_RESIDUAL_RATIO`, `fitFromSagitta` replaces it with a numerically
 * stable reconstruction instead of just nulling the result out, since "no real curvature" is
 * itself a valid, reportable answer (small radius, ~0° central angle, real sign), not a failure.
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

	const start = segmentEndpointPlate(segment[0], 'bottom');
	const end = segmentEndpointPlate(segment[segment.length - 1], 'top');
	const chordLen = M.distance(start, end);

	// A perfectly straight segment (all plate midpoints collinear -- an exact, not just near,
	// degenerate case now that corners no longer add off-axis spread) has no finite circle
	// through it; solveCircleFit's normal-equations solve throws on the singular matrix rather
	// than returning one. Mirrors arc-segmentation.ts's fitGroupRange guard. Near-but-not-exactly
	// collinear input doesn't throw here -- see the residual check just below instead.
	let radius: number;
	let center: Point;
	try {
		const abc = solveCircleFit(points);
		radius = M.get_arc_radius(abc);
		center = M.get_arc_center(abc);
		if (
			!Number.isFinite(radius) ||
			!Number.isFinite(center.x) ||
			!Number.isFinite(center.y) ||
			relativeFitResidual(points, center, radius, chordLen) > DEGENERATE_FIT_RESIDUAL_RATIO
		) {
			({ radius, center } = fitFromSagitta(points, start, end));
		}
	} catch {
		({ radius, center } = fitFromSagitta(points, start, end));
	}

	const chord = Math.min(chordLen, 2 * radius);

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
