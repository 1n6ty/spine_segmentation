import type { Polygon, Point } from '$lib/shared/geometry/geometry.type';
import { segmentIntoArcs, type FittedArc } from '$lib/shared/geometry/arc-segmentation';
import { computeCentralPath, type CentralLineControlPoint } from './central-path';
import { vertebra_order_index } from './vertebra-order';

const MIN_VERTEBRAE_PER_ARC = 2;

/** A vertebra id-range for one auto-detected arc -- the same shape a `SegmentDefinition`
 * carries, minus the `id`/`generated` bookkeeping that's the feature layer's concern, not this
 * pure geometry module's. */
export interface GeneratedVertebraRange {
	bottomId: string; // inferior-most vertebra id in the range
	topId: string; // superior-most vertebra id in the range
}

/** Groups central-line control points by `vertebraIndex`, preserving order -- not a fixed
 * stride of 2, so it stays correct when `computeCentralPath` has skipped a malformed polygon. */
function group_by_vertebra(controlPoints: CentralLineControlPoint[]): Point[][] {
	const groups: Point[][] = [];
	let currentIndex: number | null = null;
	let current: Point[] = [];

	for (const cp of controlPoints) {
		if (cp.vertebraIndex !== currentIndex) {
			if (current.length > 0) groups.push(current);
			current = [];
			currentIndex = cp.vertebraIndex;
		}
		current.push(cp.point);
	}
	if (current.length > 0) groups.push(current);

	return groups;
}

/**
 * Splits `polygons` into maximal runs that are anatomically contiguous per `VERTEBRA_ORDER` --
 * e.g. S1..L1 and C7..C2 come back as two separate chunks if the thoracic vertebrae between
 * them were never annotated. `expand_vertebra_id_range` (consumed downstream by
 * `resolve_computed_regions`/`resolve_segments`) requires every canonical vertebra between a
 * range's two ends to actually be annotated; a chunk boundary here guarantees no arc this
 * module proposes can ever cross such a gap, so a range it returns is never silently dropped
 * later for spanning unannotated vertebrae. `polygons` is assumed bottom-to-top ordered
 * (superior has a smaller `VERTEBRA_ORDER` index), same assumption the rest of this module makes.
 */
function splitIntoContiguousChunks(polygons: Polygon[]): Polygon[][] {
	const chunks: Polygon[][] = [];
	let current: Polygon[] = [];

	for (const poly of polygons) {
		const prev = current.at(-1);
		if (prev && vertebra_order_index(prev.id) - vertebra_order_index(poly.id) !== 1) {
			chunks.push(current);
			current = [];
		}
		current.push(poly);
	}
	if (current.length > 0) chunks.push(current);

	return chunks;
}

/** Arc detection for one anatomically-contiguous chunk -- the actual fit/DP/BIC pipeline,
 * see `computeGeneratedVertebraRanges`'s own doc comment for the algorithm. */
function computeRangesForChunk(polygons: Polygon[]): GeneratedVertebraRange[] {
	const centralPath = computeCentralPath(polygons);
	if (!centralPath) return [];

	// Same non-endplate exclusion as medical-parameters/calculators/segments.ts: S1's inferior
	// plate (sacral base) and C2's superior plate (odontoid) aren't real disc-bearing endplates,
	// so they shouldn't be allowed to pull the arc-fitting circle off-shape. Unlike segments.ts
	// there's no single start/end role to substitute a replacement point into here -- arcs are
	// bounded by whichever vertebrae the DP partition lands on, not a fixed pair -- so this is a
	// straight exclusion. central-path.ts's own controlPoints (central line, minimap, etc. --
	// anything that draws) are untouched; this filtering is local to arc detection.
	const controlPoints = centralPath.controlPoints.filter((cp) => {
		const id = polygons[cp.vertebraIndex].id;
		if (id === 'S1' && cp.plate === 'bottom') return false;
		if (id === 'C2' && cp.plate === 'top') return false;
		return true;
	});

	const groups = group_by_vertebra(controlPoints);
	const result = segmentIntoArcs(groups, { minGroupsPerArc: MIN_VERTEBRAE_PER_ARC });
	if (!result) return [];

	// vertebraIndexByGroup[g] = the polygons[] index the g-th group's points came from.
	const vertebraIndexByGroup: number[] = [];
	let currentIndex: number | null = null;
	for (const cp of controlPoints) {
		if (cp.vertebraIndex !== currentIndex) {
			vertebraIndexByGroup.push(cp.vertebraIndex);
			currentIndex = cp.vertebraIndex;
		}
	}

	return result.arcs.map((arc: FittedArc) => ({
		bottomId: polygons[vertebraIndexByGroup[arc.startGroup]].id,
		topId: polygons[vertebraIndexByGroup[arc.endGroup]].id
	}));
}

/**
 * Automatically approximates the spine's central line as a connected sequence of circular arcs
 * (least-squares circle fit per candidate range, DP over partition boundaries, BIC to pick the
 * arc count -- see `segmentIntoArcs`), and returns each arc as a vertebra id-range.
 * `minGroupsPerArc: 2` is the "a segment could be composed of at least 2 vertebrae" rule.
 *
 * Every vertebra's own bottom+top plate pair is grouped and kept together (see
 * `group_by_vertebra`), so an arc boundary never splits a single vertebra across two arcs. Nor
 * does an arc ever span an unannotated gap (see `splitIntoContiguousChunks`) -- purely
 * geometrically, nothing stops the fit from spanning one (e.g. a smooth curve where only S1..L1
 * and C7..C2 are annotated, thoracic missing entirely, fits one clean circle end to end), but
 * `expand_vertebra_id_range` downstream can never resolve such a range to an actual vertebra
 * list, so it silently vanished before ever reaching a display -- a real range computed, then
 * never shown, anywhere it's consumed.
 */
export function computeGeneratedVertebraRanges(polygons: Polygon[]): GeneratedVertebraRange[] {
	return splitIntoContiguousChunks(polygons).flatMap(computeRangesForChunk);
}
