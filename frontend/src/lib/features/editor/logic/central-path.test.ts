import { describe, it, expect } from 'vitest';
import { computeCentralPath } from './central-path';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

function square(id: string, cx: number, cy: number, h = 10): Polygon {
	return {
		uuid: id,
		id,
		points: [
			{ x: cx - h, y: cy + h }, // bottom-left
			{ x: cx - h, y: cy - h }, // top-left
			{ x: cx + h, y: cy - h }, // top-right
			{ x: cx + h, y: cy + h } // bottom-right
		]
	};
}

describe('computeCentralPath', () => {
	it('returns null for no vertebrae', () => {
		expect(computeCentralPath([])).toBeNull();
	});

	it('emits bottom-then-top control points per vertebra, in vertebra order', () => {
		const polygons = [square('S1', 0, 0), square('L5', 0, 40)];
		const path = computeCentralPath(polygons)!;

		expect(path.controlPoints).toHaveLength(4);
		expect(path.controlPoints.map((cp) => [cp.vertebraIndex, cp.plate])).toEqual([
			[0, 'bottom'],
			[0, 'top'],
			[1, 'bottom'],
			[1, 'top']
		]);
	});

	it('control points sit at the exact midpoint of their endplate corner pair', () => {
		const polygons = [square('S1', 0, 0)];
		const path = computeCentralPath(polygons)!;

		const [bottom, top] = path.controlPoints;
		expect(bottom.point).toEqual({ x: 0, y: 10 }); // midpoint of points[0], points[3]
		expect(bottom.cornerIndices).toEqual([0, 3]);
		expect(top.point).toEqual({ x: 0, y: -10 }); // midpoint of points[1], points[2]
		expect(top.cornerIndices).toEqual([1, 2]);
	});

	it('degenerates to a straight line through the 2 control points of a single vertebra', () => {
		const path = computeCentralPath([square('S1', 0, 0)])!;
		const samples = path.samplePoints();

		samples.forEach((p) => expect(p.x).toBeCloseTo(0, 6));
	});

	it('samples points along every segment plus the final endpoint', () => {
		const polygons = [square('S1', 0, 0), square('L5', 0, 40), square('L4', 0, 80)];
		const path = computeCentralPath(polygons)!;

		const samples = path.samplePoints(4);
		// 3 vertebrae -> 6 control points -> 5 segments * 4 samples + 1 final point
		expect(samples).toHaveLength(5 * 4 + 1);
	});

	it('skips a malformed polygon (not exactly 4 points) rather than throwing', () => {
		const malformed: Polygon = { uuid: 'bad', id: 'bad', points: [{ x: 0, y: 0 }] };
		const path = computeCentralPath([square('S1', 0, 0), malformed, square('L5', 0, 40)])!;

		expect(path.controlPoints.map((cp) => cp.vertebraIndex)).toEqual([0, 0, 2, 2]);
	});
});
