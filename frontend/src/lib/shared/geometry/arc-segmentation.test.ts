import { describe, it, expect } from 'vitest';
import { segmentIntoArcs } from './arc-segmentation';
import type { Point } from './geometry.type';

function on_circle(cx: number, cy: number, r: number, degrees: number): Point {
	const rad = (degrees * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** A 2-point group straddling `degrees` on the given circle -- mirrors the spine wrapper's
 * "2 midpoints per vertebra" grouping, and keeps every minGroupsPerArc=2 arc at >=4 points
 * (solveCircleFit's practical minimum for a meaningful, non-degenerate fit). */
function group_at(cx: number, cy: number, r: number, degrees: number, spread = 4): Point[] {
	return [on_circle(cx, cy, r, degrees - spread / 2), on_circle(cx, cy, r, degrees + spread / 2)];
}

describe('segmentIntoArcs', () => {
	it('returns null when there are fewer than 2 * minGroupsPerArc groups', () => {
		const groups = [
			group_at(0, 0, 10, 0),
			group_at(0, 0, 10, 30),
			group_at(0, 0, 10, 60)
		];
		expect(segmentIntoArcs(groups, { minGroupsPerArc: 2 })).toBeNull();
	});

	it('does not throw on perfectly collinear points, even though no circle truly fits them', () => {
		const groups = Array.from({ length: 6 }, (_, i) => [
			{ x: i, y: i },
			{ x: i + 0.1, y: i + 0.1 }
		]);
		expect(() => segmentIntoArcs(groups, { minGroupsPerArc: 2 })).not.toThrow();
	});

	it('picks a single arc (k=1) for points sampled exactly from one circle', () => {
		// Every candidate sub-range also fits this same circle perfectly (SSE ~ 0 for every k),
		// so BIC's complexity penalty alone should prefer the simplest model, k=1, over
		// gratuitously splitting a perfect single arc into more pieces.
		const groups = Array.from({ length: 8 }, (_, i) => group_at(0, 0, 20, i * 10));

		const result = segmentIntoArcs(groups, { minGroupsPerArc: 2 });

		expect(result?.k).toBe(1);
		expect(result?.arcs).toHaveLength(1);
		expect(result?.arcs[0]).toMatchObject({ startGroup: 0, endGroup: 7 });
		expect(result?.arcs[0].radius).toBeCloseTo(20, 3);
	});

	it('splits into two arcs (k=2) at the junction between two clearly distinct circles', () => {
		const circleA = [0, 30, 60, 90].map((deg) => group_at(0, 0, 10, deg));
		const circleB = [90, 120, 150, 180].map((deg) => group_at(100, 0, 5, deg));
		const groups = [...circleA, ...circleB];

		const result = segmentIntoArcs(groups, { minGroupsPerArc: 2 });

		expect(result?.k).toBe(2);
		expect(result?.arcs).toHaveLength(2);
		expect(result?.arcs[0]).toMatchObject({ startGroup: 0, endGroup: 3 });
		expect(result?.arcs[1]).toMatchObject({ startGroup: 4, endGroup: 7 });
		expect(result?.arcs[0].radius).toBeCloseTo(10, 3);
		expect(result?.arcs[0].center.x).toBeCloseTo(0, 3);
		expect(result?.arcs[0].center.y).toBeCloseTo(0, 3);
		expect(result?.arcs[1].radius).toBeCloseTo(5, 3);
		expect(result?.arcs[1].center.x).toBeCloseTo(100, 3);
		expect(result?.arcs[1].center.y).toBeCloseTo(0, 3);
	});

	it('reports a finite BIC per candidate k in bicByK, indexed by k - 1', () => {
		const circleA = [0, 30, 60, 90].map((deg) => group_at(0, 0, 10, deg));
		const circleB = [90, 120, 150, 180].map((deg) => group_at(100, 0, 5, deg));
		const groups = [...circleA, ...circleB];

		const result = segmentIntoArcs(groups, { minGroupsPerArc: 2 });

		expect(result?.bicByK).toHaveLength(4); // Kmax = floor(8 / 2) = 4
		expect(result?.bicByK.every((b) => Number.isFinite(b))).toBe(true);
	});

	it('respects a custom minGroupsPerArc', () => {
		const groups = [0, 30, 60, 90, 120, 150].map((deg) => group_at(0, 0, 10, deg));
		// minGroupsPerArc=3 -> Kmax = floor(6/3) = 2, and a single arc must be at least 3 groups.
		const result = segmentIntoArcs(groups, { minGroupsPerArc: 3 });

		expect(result).not.toBeNull();
		for (const arc of result!.arcs) {
			expect(arc.endGroup - arc.startGroup + 1).toBeGreaterThanOrEqual(3);
		}
	});
});
