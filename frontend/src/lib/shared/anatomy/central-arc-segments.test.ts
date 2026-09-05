import { describe, it, expect } from 'vitest';
import { computeGeneratedVertebraRanges } from './central-arc-segments';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';

/** A vertebra polygon whose bottom/top plate midpoints sit exactly on the given circle at
 * `degrees` (+/- a small spread), spine-ordered inferior-to-superior like `orderAndName()`
 * guarantees. Corner order follows `PLATE_CORNER_INDICES` (`central-path.ts`): bottom = [0,3],
 * top = [1,2]. */
function vertebra_on_circle(id: string, cx: number, cy: number, r: number, degrees: number): Polygon {
	const spread = 3;
	const rad = (deg: number) => (deg * Math.PI) / 180;
	const at = (deg: number): Point => ({ x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) });

	const bottom = at(degrees - spread / 2);
	const top = at(degrees + spread / 2);
	// Perpendicular-ish offset so bottom/top aren't literally the same point pair collapsed to
	// a zero-area polygon; corner pairs straddle each plate's midpoint.
	const perp = { x: -(top.y - bottom.y), y: top.x - bottom.x };
	const norm = Math.hypot(perp.x, perp.y) || 1;
	const half = { x: (perp.x / norm) * 2, y: (perp.y / norm) * 2 };

	return {
		uuid: id,
		id,
		points: [
			{ x: bottom.x - half.x, y: bottom.y - half.y }, // 0: bottom-left
			{ x: top.x - half.x, y: top.y - half.y }, // 1: top-left
			{ x: top.x + half.x, y: top.y + half.y }, // 2: top-right
			{ x: bottom.x + half.x, y: bottom.y + half.y } // 3: bottom-right
		]
	};
}

describe('computeGeneratedVertebraRanges', () => {
	it('returns [] when there are too few vertebrae for even one arc', () => {
		const polygons = [vertebra_on_circle('S1', 0, 0, 50, 0), vertebra_on_circle('L5', 0, 0, 50, 10)];
		expect(computeGeneratedVertebraRanges(polygons)).toEqual([]);
	});

	it('returns [] for no vertebrae', () => {
		expect(computeGeneratedVertebraRanges([])).toEqual([]);
	});

	it('detects one arc spanning all vertebrae sampled from a single circle', () => {
		const ids = ['S1', 'L5', 'L4', 'L3'];
		const polygons = ids.map((id, i) => vertebra_on_circle(id, 0, 0, 100, i * 10));

		const ranges = computeGeneratedVertebraRanges(polygons);

		expect(ranges).toEqual([{ bottomId: 'S1', topId: 'L3' }]);
	});

	it('splits into two ranges at the junction between two clearly distinct curve regions', () => {
		const lower = ['S1', 'L5', 'L4', 'L3'].map((id, i) => vertebra_on_circle(id, 0, 0, 100, i * 10));
		const upper = ['L2', 'L1', 'Th12', 'Th11'].map((id, i) =>
			vertebra_on_circle(id, 500, 0, 20, 90 + i * 15)
		);
		const polygons = [...lower, ...upper];

		const ranges = computeGeneratedVertebraRanges(polygons);

		expect(ranges).toEqual([
			{ bottomId: 'S1', topId: 'L3' },
			{ bottomId: 'L2', topId: 'Th11' }
		]);
	});

	it('never splits a single vertebra across two arcs (an arc boundary always falls between vertebrae)', () => {
		const lower = ['S1', 'L5', 'L4', 'L3'].map((id, i) => vertebra_on_circle(id, 0, 0, 100, i * 10));
		const upper = ['L2', 'L1', 'Th12', 'Th11'].map((id, i) =>
			vertebra_on_circle(id, 500, 0, 20, 90 + i * 15)
		);
		const polygons = [...lower, ...upper];

		const ranges = computeGeneratedVertebraRanges(polygons);
		const allIds = ids_seen(polygons);
		for (const range of ranges) {
			expect(allIds).toContain(range.bottomId);
			expect(allIds).toContain(range.topId);
		}
	});
});

function ids_seen(polygons: Polygon[]): string[] {
	return polygons.map((p) => p.id);
}
