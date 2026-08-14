import { distance, centroid, get_signed_angle } from '$lib/shared/geometry/geometry';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';

const vertebraeNames = [
	'S1',
	'L5',
	'L4',
	'L3',
	'L2',
	'L1',
	'Th12',
	'Th11',
	'Th10',
	'Th9',
	'Th8',
	'Th7',
	'Th6',
	'Th5',
	'Th4',
	'Th3',
	'Th2',
	'Th1',
	'C7',
	'C6',
	'C5',
	'C4',
	'C3',
	'C2'
];

/**
 * Solves the sequence using a Greedy Nearest Neighbor approach.
 */
function solveGreedyTSP(centers: Point[]): number[] {
	if (centers.length === 0) return [];

	// 1. Find the starting point (highest Y value, typically S1 in medical imaging)
	let startIdx = 0;
	let maxY = centers[0].y;
	for (let i = 1; i < centers.length; i++) {
		if (centers[i].y > maxY) {
			maxY = centers[i].y;
			startIdx = i;
		}
	}

	const orderedIndices: number[] = [startIdx];
	const visited = new Set<number>([startIdx]);

	// 2. Iteratively find the nearest unvisited neighbor
	while (orderedIndices.length < centers.length) {
		const lastIdx = orderedIndices[orderedIndices.length - 1];
		const lastPoint = centers[lastIdx];

		let nearestIdx = -1;
		let minDistance = Infinity;

		for (let i = 0; i < centers.length; i++) {
			if (visited.has(i)) continue;

			const dist = distance(lastPoint, centers[i]);
			if (dist < minDistance) {
				minDistance = dist;
				nearestIdx = i;
			}
		}

		if (nearestIdx !== -1) {
			orderedIndices.push(nearestIdx);
			visited.add(nearestIdx);
		}
	}

	return orderedIndices;
}

function getOrderedReferencePoints(
	polygon: Polygon,
	nearestPolygon: Polygon,
	pos: 'up' | 'down'
): Polygon {
	if (polygon.points.length === 0) return polygon;

	// 1. Calculate the average (centroid) of the nearest polygon's points
	const nearestAvg = centroid(nearestPolygon.points);

	// 2. Find the 2 points farthest from the nearest polygon's centroid (mimicking
	// np.argpartition). NOTE: despite "nearest" in the name, this sorts descending and
	// takes the top 2 — i.e. the two points FARTHEST from the neighboring polygon, not
	// closest. That's what the empirically-verified point-order safety net in
	// autofill.test.ts currently depends on; flagged here rather than silently
	// "fixed" since flipping it would change point ordering with no ground-truth
	// annotated data available to verify against.
	const indexedDistances = polygon.points.map((p, index) => {
		return { index, distance: distance(p, nearestAvg) };
	});

	indexedDistances.sort((a, b) => b.distance - a.distance);
	const nearestIndexes = [indexedDistances[0].index, indexedDistances[1].index];

	// 3. Separate points into 'up' and 'down' groups based on the 'pos' argument
	const closestPoints = nearestIndexes.map((idx) => polygon.points[idx]);
	const remainingPoints = polygon.points.filter((_, idx) => !nearestIndexes.includes(idx));

	let up: Point[];
	let down: Point[];

	if (pos === 'down') {
		up = closestPoints;
		down = remainingPoints;
	} else {
		up = remainingPoints;
		down = closestPoints;
	}

	// 4. Calculate down_avg and the main vector (main_vec)
	const downAvg = centroid(down);
	const upAvg = centroid(up);

	const mainVec: Point = { x: upAvg.x - downAvg.x, y: upAvg.y - downAvg.y };

	// 5. Calculate signed angles and sort points in descending order (mimicking np.argsort(...)[::-1])
	const pointsWithAngles = polygon.points.map((p) => {
		const vecToPoint: Point = { x: p.x - downAvg.x, y: p.y - downAvg.y };
		const angle = get_signed_angle(mainVec, vecToPoint);
		return { p, angle };
	});

	// Sort descending by angle
	pointsWithAngles.sort((a, b) => b.angle - a.angle);

	return {
		uuid: polygon.uuid,
		id: polygon.id,
		points: pointsWithAngles.map((item) => item.p)
	};
}

/**
 * Orders polygons from S1 to C2 and assigns names from a provided array.
 */
export function orderAndName(polygons: Polygon[]): Polygon[] {
	if (polygons.length == 1) {
		const poly = polygons[0];
		poly.id = '';

		return [poly];
	}

	// Calculate centers for all polygons
	const centers = polygons.map((p) => centroid(p.points));

	// Get the sequence of indices
	const sequence = solveGreedyTSP(centers);

	// Reorder and assign names
	const orderedPolygons = sequence.map((originalIdx, orderIdx) => {
		let poly = polygons[originalIdx];

		poly =
			orderIdx == 0
				? getOrderedReferencePoints(poly, polygons[sequence[orderIdx + 1]], 'up')
				: getOrderedReferencePoints(poly, polygons[sequence[orderIdx - 1]], 'down');

		// Assign name from the specific array if available
		if (vertebraeNames[orderIdx]) {
			poly.id = vertebraeNames[orderIdx];
		}

		return poly;
	});

	return orderedPolygons;
}
