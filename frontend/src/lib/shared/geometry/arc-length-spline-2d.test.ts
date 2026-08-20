import { describe, it, expect } from 'vitest';
import { fitArcLengthSpline2D } from './arc-length-spline-2d';

describe('fitArcLengthSpline2D', () => {
	it('throws with fewer than 2 points', () => {
		expect(() => fitArcLengthSpline2D([{ x: 0, y: 0 }])).toThrow();
	});

	it('degenerates to a straight line for exactly 2 points, t equal to the chord length', () => {
		const spline = fitArcLengthSpline2D([
			{ x: 0, y: 0 },
			{ x: 3, y: 4 }
		]);

		expect(spline.t[0]).toBe(0);
		expect(spline.t[1]).toBeCloseTo(5, 10);
		expect(spline.totalLength).toBeCloseTo(5, 10);

		const mid = spline.evaluate(2.5);
		expect(mid.x).toBeCloseTo(1.5, 6);
		expect(mid.y).toBeCloseTo(2, 6);
	});

	it('for collinear control points, arc length equals chord length exactly (straight curve)', () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 25, y: 0 },
			{ x: 30, y: 0 }
		];
		const spline = fitArcLengthSpline2D(points);

		expect(spline.t.map((t) => Math.round(t * 1e6) / 1e6)).toEqual([0, 10, 25, 30]);
		points.forEach((p, i) => {
			const evaluated = spline.evaluate(spline.t[i]);
			expect(evaluated.x).toBeCloseTo(p.x, 4);
			expect(evaluated.y).toBeCloseTo(p.y, 4);
		});
	});

	it('interpolates through every control point of a curved path', () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 10, y: 5 },
			{ x: 20, y: -5 },
			{ x: 30, y: 8 },
			{ x: 40, y: 0 }
		];
		const spline = fitArcLengthSpline2D(points);

		points.forEach((p, i) => {
			const evaluated = spline.evaluate(spline.t[i]);
			expect(evaluated.x).toBeCloseTo(p.x, 3);
			expect(evaluated.y).toBeCloseTo(p.y, 3);
		});
	});

	it('t is strictly ascending and arc length is >= the straight chord distance', () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 10, y: 8 },
			{ x: 22, y: -3 },
			{ x: 35, y: 10 }
		];
		const spline = fitArcLengthSpline2D(points);

		for (let i = 1; i < spline.t.length; i++) {
			expect(spline.t[i]).toBeGreaterThan(spline.t[i - 1]);
		}

		const chord = Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y);
		expect(spline.totalLength).toBeGreaterThanOrEqual(chord);
	});

	it('converges to a finite result for a larger point set (mirrors many vertebrae)', () => {
		const points = Array.from({ length: 48 }, (_, i) => ({
			x: (i % 2 === 0 ? -1 : 1) * 5,
			y: i * 4
		}));
		const spline = fitArcLengthSpline2D(points);

		expect(Number.isFinite(spline.totalLength)).toBe(true);
		expect(spline.t.every((t) => Number.isFinite(t))).toBe(true);
		const mid = spline.evaluate(spline.totalLength / 2);
		expect(Number.isFinite(mid.x)).toBe(true);
		expect(Number.isFinite(mid.y)).toBe(true);
	});
});
