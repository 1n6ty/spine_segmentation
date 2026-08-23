import type { Point } from './geometry.type';
import { solveCircleFit } from './circle-fit';
import { get_arc_center, get_arc_radius, distance } from './geometry';

const EPSILON = 1e-9;

export interface FittedArc {
	startGroup: number; // inclusive index into the `groups` array passed to segmentIntoArcs
	endGroup: number; // inclusive
	center: Point;
	radius: number;
	sse: number; // sum of squared (distance(p, center) - radius) over the arc's own points
}

export interface ArcSegmentationResult {
	arcs: FittedArc[];
	k: number;
	bicByK: number[]; // bicByK[k - 1] = BIC score for that candidate k (Infinity where unreachable)
}

interface CircleFit {
	center: Point;
	radius: number;
	sse: number;
}

/** Least-squares circle fit + residual SSE over the flattened points of groups[i..j] inclusive. */
function fitGroupRange(groups: Point[][], i: number, j: number): CircleFit | null {
	const points = groups.slice(i, j + 1).flat();
	try {
		const abc = solveCircleFit(points);
		const center = get_arc_center(abc);
		const radius = get_arc_radius(abc);
		if (!Number.isFinite(radius) || !Number.isFinite(center.x) || !Number.isFinite(center.y)) {
			return null;
		}
		const sse = points.reduce((acc, p) => acc + (distance(p, center) - radius) ** 2, 0);
		return { center, radius, sse };
	} catch {
		return null; // degenerate/collinear points -- no meaningful circle through them
	}
}

/**
 * Approximates an ordered sequence of point groups by a connected sequence of circular arcs,
 * per the pipeline: least-squares circle fit per candidate range -> DP over partition
 * boundaries -> BIC to pick the number of arcs. Groups (not raw points) are the atomic unit a
 * boundary can fall between, so a caller can guarantee an arc never splits a group in half
 * (the spine wrapper in `shared/anatomy/central-arc-segments.ts` passes one group per vertebra,
 * so an arc never contains only half of a vertebra).
 *
 * Returns null when there aren't enough groups for even one arc (`groups.length <
 * 2 * minGroupsPerArc`) or when every candidate partition is geometrically degenerate (e.g.
 * perfectly collinear points, which have no finite-radius circle through them).
 */
export function segmentIntoArcs(
	groups: Point[][],
	opts: { minGroupsPerArc?: number; paramsPerArc?: number } = {}
): ArcSegmentationResult | null {
	const minGroupsPerArc = opts.minGroupsPerArc ?? 2;
	const paramsPerArc = opts.paramsPerArc ?? 3;
	const V = groups.length;
	if (minGroupsPerArc < 1 || V < 2 * minGroupsPerArc) return null;

	// cost[i][j]: circle fit over groups[i..j] inclusive (only populated where the range is at
	// least minGroupsPerArc long; null means "no valid fit", either too short or degenerate).
	const cost: (CircleFit | null)[][] = Array.from({ length: V }, () => new Array<CircleFit | null>(V).fill(null));
	for (let i = 0; i < V; i++) {
		for (let j = i + minGroupsPerArc - 1; j < V; j++) {
			cost[i][j] = fitGroupRange(groups, i, j);
		}
	}

	const Kmax = Math.floor(V / minGroupsPerArc);
	const n = groups.reduce((acc, g) => acc + g.length, 0);

	// dp[k][i]: min total SSE partitioning groups[0..i) into k arcs; backptr[k][i]: the chosen
	// previous boundary j. dp[0][0] = 0 is the only valid empty partition.
	const dp: number[][] = Array.from({ length: Kmax + 1 }, () => new Array(V + 1).fill(Infinity));
	const backptr: number[][] = Array.from({ length: Kmax + 1 }, () => new Array(V + 1).fill(-1));
	dp[0][0] = 0;

	for (let k = 1; k <= Kmax; k++) {
		for (let i = minGroupsPerArc * k; i <= V; i++) {
			for (let j = minGroupsPerArc * (k - 1); j <= i - minGroupsPerArc; j++) {
				if (dp[k - 1][j] === Infinity) continue;
				const fit = cost[j][i - 1];
				if (!fit) continue;
				const total = dp[k - 1][j] + fit.sse;
				if (total < dp[k][i]) {
					dp[k][i] = total;
					backptr[k][i] = j;
				}
			}
		}
	}

	const bicByK: number[] = [];
	let bestK = 0;
	let bestBic = Infinity;
	for (let k = 1; k <= Kmax; k++) {
		const sse = dp[k][V];
		if (sse === Infinity) {
			bicByK.push(Infinity);
			continue;
		}
		const bic = n * Math.log(Math.max(sse, EPSILON) / n) + paramsPerArc * k * Math.log(n);
		bicByK.push(bic);
		if (bic < bestBic) {
			bestBic = bic;
			bestK = k;
		}
	}

	if (bestK === 0) return null;

	// Traceback from V down to 0 through the chosen boundaries for bestK.
	const boundaries: number[] = [V];
	for (let k = bestK, i = V; k > 0; k--) {
		const j = backptr[k][i];
		boundaries.push(j);
		i = j;
	}
	boundaries.reverse();

	const arcs: FittedArc[] = [];
	for (let m = 0; m < boundaries.length - 1; m++) {
		const start = boundaries[m];
		const end = boundaries[m + 1] - 1;
		const fit = cost[start][end]!;
		arcs.push({ startGroup: start, endGroup: end, center: fit.center, radius: fit.radius, sse: fit.sse });
	}

	return { arcs, k: bestK, bicByK };
}
