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

	it('returns null for a single vertebra (its 2 midpoints are both spine-outermost, so both are dropped)', () => {
		expect(computeCentralPath([square('S1', 0, 0)])).toBeNull();
	});

	it('drops the spine-outermost bottom and top points, keeping only the interior pair, for 2 vertebrae', () => {
		const polygons = [square('S1', 0, 40), square('L5', 0, 0)];
		const path = computeCentralPath(polygons)!;

		expect(path.controlPoints).toHaveLength(2);
		expect(path.controlPoints.map((cp) => [cp.vertebraIndex, cp.plate])).toEqual([
			[0, 'top'],
			[1, 'bottom']
		]);
	});

	it('emits interior bottom/top control points per vertebra, in vertebra order, for 3+ vertebrae', () => {
		const polygons = [square('S1', 0, 80), square('L5', 0, 40), square('L4', 0, 0)];
		const path = computeCentralPath(polygons)!;

		// 3 vertebrae -> 6 raw midpoints -> drop first (S1 bottom) and last (L4 top) -> 4 left.
		expect(path.controlPoints).toHaveLength(4);
		expect(path.controlPoints.map((cp) => [cp.vertebraIndex, cp.plate])).toEqual([
			[0, 'top'],
			[1, 'bottom'],
			[1, 'top'],
			[2, 'bottom']
		]);
	});

	it('control points sit at the exact midpoint of their endplate corner pair', () => {
		const polygons = [square('S1', 0, 40), square('L5', 0, 0)];
		const path = computeCentralPath(polygons)!;

		const [s1Top, l5Bottom] = path.controlPoints;
		expect(s1Top.point).toEqual({ x: 0, y: 30 }); // midpoint of points[1], points[2]
		expect(s1Top.cornerIndices).toEqual([1, 2]);
		expect(l5Bottom.point).toEqual({ x: 0, y: 10 }); // midpoint of points[0], points[3]
		expect(l5Bottom.cornerIndices).toEqual([0, 3]);
	});

	it('samples points along every segment plus the final endpoint', () => {
		const polygons = [square('S1', 0, 80), square('L5', 0, 40), square('L4', 0, 0)];
		const path = computeCentralPath(polygons)!;

		const samples = path.samplePoints(4);
		// 4 control points -> 3 segments * 4 samples + 1 final point
		expect(samples).toHaveLength(3 * 4 + 1);
	});

	it('skips a malformed polygon (not exactly 4 points) rather than throwing', () => {
		const malformed: Polygon = { uuid: 'bad', id: 'bad', points: [{ x: 0, y: 0 }] };
		const polygons = [square('S1', 0, 80), malformed, square('L5', 0, 40), square('L4', 0, 0)];
		const path = computeCentralPath(polygons)!;

		expect(path.controlPoints.map((cp) => cp.vertebraIndex)).toEqual([0, 2, 2, 3]);
	});
});
