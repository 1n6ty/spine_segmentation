import type { Polygon, Point } from '$lib/shared/geometry/geometry.type';
import { segmentIntoArcs, type FittedArc } from '$lib/shared/geometry/arc-segmentation';
import { computeCentralPath, type CentralLineControlPoint } from './central-path';

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
 * Automatically approximates the spine's central line as a connected sequence of circular arcs
 * (least-squares circle fit per candidate range, DP over partition boundaries, BIC to pick the
 * arc count -- see `segmentIntoArcs`), and returns each arc as a vertebra id-range.
 * `minGroupsPerArc: 2` is the "a segment could be composed of at least 2 vertebrae" rule.
 *
 * Every vertebra's own bottom+top plate pair is grouped and kept together (see
 * `group_by_vertebra`), so an arc boundary never splits a single vertebra across two arcs.
 */
export function computeGeneratedVertebraRanges(polygons: Polygon[]): GeneratedVertebraRange[] {
	const centralPath = computeCentralPath(polygons);
	if (!centralPath) return [];

	const groups = group_by_vertebra(centralPath.controlPoints);
	const result = segmentIntoArcs(groups, { minGroupsPerArc: MIN_VERTEBRAE_PER_ARC });
	if (!result) return [];

	// vertebraIndexByGroup[g] = the polygons[] index the g-th group's points came from.
	const vertebraIndexByGroup: number[] = [];
	let currentIndex: number | null = null;
	for (const cp of centralPath.controlPoints) {
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
