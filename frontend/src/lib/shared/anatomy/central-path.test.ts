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

	it('includes both midpoints of a single vertebra (its own bottom and top plate)', () => {
		const path = computeCentralPath([square('S1', 0, 0)])!;

		expect(path.controlPoints).toHaveLength(2);
		expect(path.controlPoints.map((cp) => [cp.vertebraIndex, cp.plate])).toEqual([
			[0, 'bottom'],
			[0, 'top']
		]);
	});

	it('includes every vertebra bottom/top point, including the spine outermost pair, for 2 vertebrae', () => {
		const polygons = [square('S1', 0, 40), square('L5', 0, 0)];
		const path = computeCentralPath(polygons)!;

		expect(path.controlPoints).toHaveLength(4);
		expect(path.controlPoints.map((cp) => [cp.vertebraIndex, cp.plate])).toEqual([
			[0, 'bottom'],
			[0, 'top'],
			[1, 'bottom'],
			[1, 'top']
		]);
	});

	it('emits bottom/top control points per vertebra, in vertebra order, for 3+ vertebrae', () => {
		const polygons = [square('S1', 0, 80), square('L5', 0, 40), square('L4', 0, 0)];
		const path = computeCentralPath(polygons)!;

		// 3 vertebrae -> 6 raw midpoints, none dropped.
		expect(path.controlPoints).toHaveLength(6);
		expect(path.controlPoints.map((cp) => [cp.vertebraIndex, cp.plate])).toEqual([
			[0, 'bottom'],
			[0, 'top'],
			[1, 'bottom'],
			[1, 'top'],
			[2, 'bottom'],
			[2, 'top']
		]);
	});

	it('control points sit at the exact midpoint of their endplate corner pair', () => {
		const polygons = [square('S1', 0, 40), square('L5', 0, 0)];
		const path = computeCentralPath(polygons)!;

		const [s1Bottom, s1Top] = path.controlPoints;
		expect(s1Bottom.point).toEqual({ x: 0, y: 50 }); // midpoint of points[0], points[3]
		expect(s1Bottom.cornerIndices).toEqual([0, 3]);
		expect(s1Top.point).toEqual({ x: 0, y: 30 }); // midpoint of points[1], points[2]
		expect(s1Top.cornerIndices).toEqual([1, 2]);
	});

	it('samples points along every segment plus the final endpoint', () => {
		const polygons = [square('S1', 0, 80), square('L5', 0, 40), square('L4', 0, 0)];
		const path = computeCentralPath(polygons)!;

		const samples = path.samplePoints(4);
		// 6 control points -> 5 segments * 4 samples + 1 final point
		expect(samples).toHaveLength(5 * 4 + 1);
	});

	it('skips a malformed polygon (not exactly 4 points) rather than throwing', () => {
		const malformed: Polygon = { uuid: 'bad', id: 'bad', points: [{ x: 0, y: 0 }] };
		const polygons = [square('S1', 0, 80), malformed, square('L5', 0, 40), square('L4', 0, 0)];
		const path = computeCentralPath(polygons)!;

		expect(path.controlPoints.map((cp) => cp.vertebraIndex)).toEqual([0, 0, 2, 2, 3, 3]);
	});
});
