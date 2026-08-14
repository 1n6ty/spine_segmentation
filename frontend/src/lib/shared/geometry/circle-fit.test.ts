import { describe, it, expect } from 'vitest';
import { solveCircleFit } from './circle-fit';
import { get_arc_radius, get_arc_center } from './geometry';

describe('solveCircleFit', () => {
	it('throws with fewer than 3 points', () => {
		expect(() =>
			solveCircleFit([
				{ x: 0, y: 0 },
				{ x: 1, y: 1 }
			])
		).toThrow();
	});

	it('fits a circle of known radius/center from points on its circumference', () => {
		// Points on a circle centered at (10, 5) with radius 5
		const points = [
			{ x: 15, y: 5 },
			{ x: 10, y: 10 },
			{ x: 5, y: 5 },
			{ x: 10, y: 0 }
		];

		const abc = solveCircleFit(points);
		expect(get_arc_radius(abc)).toBeCloseTo(5, 3);
		const center = get_arc_center(abc);
		expect(center.x).toBeCloseTo(10, 3);
		expect(center.y).toBeCloseTo(5, 3);
	});
});
