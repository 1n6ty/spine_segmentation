import { describe, it, expect } from 'vitest';
import { fitNaturalCubicSpline1D } from './natural-cubic-spline';

describe('fitNaturalCubicSpline1D', () => {
	it('throws with fewer than 2 points', () => {
		expect(() => fitNaturalCubicSpline1D([0], [0])).toThrow();
	});

	it('throws when t and y lengths mismatch', () => {
		expect(() => fitNaturalCubicSpline1D([0, 1, 2], [0, 1])).toThrow();
	});

	it('interpolates exactly through every control point', () => {
		const t = [0, 1, 2.5, 4];
		const y = [0, 3, -1, 2];
		const spline = fitNaturalCubicSpline1D(t, y);

		t.forEach((x, i) => expect(spline.evaluate(x)).toBeCloseTo(y[i], 8));
	});

	it('satisfies the natural boundary condition (second derivative is 0 at both ends)', () => {
		const t = [0, 1, 2.5, 4];
		const y = [0, 3, -1, 2];
		const spline = fitNaturalCubicSpline1D(t, y);

		expect(spline.secondDerivative(t[0])).toBeCloseTo(0, 8);
		expect(spline.secondDerivative(t[t.length - 1])).toBeCloseTo(0, 8);
	});

	it('degenerates to a straight line for exactly 2 points', () => {
		const spline = fitNaturalCubicSpline1D([0, 10], [1, 21]);

		expect(spline.evaluate(5)).toBeCloseTo(11, 8); // linear interpolation: 1 + 2*5
		expect(spline.derivative(5)).toBeCloseTo(2, 8);
		expect(spline.secondDerivative(5)).toBeCloseTo(0, 8);
	});

	it('reduces to the exact line for collinear control points, any spacing', () => {
		const t = [0, 1, 3, 3.5, 8];
		const y = t.map((x) => 2 * x + 1);
		const spline = fitNaturalCubicSpline1D(t, y);

		[0.5, 2, 3.2, 6].forEach((x) => {
			expect(spline.evaluate(x)).toBeCloseTo(2 * x + 1, 8);
			expect(spline.derivative(x)).toBeCloseTo(2, 8);
			expect(spline.secondDerivative(x)).toBeCloseTo(0, 8);
		});
	});

	it('analytic derivative matches a central finite-difference approximation', () => {
		const t = [0, 1, 2.5, 4, 6];
		const y = [0, 3, -1, 2, 5];
		const spline = fitNaturalCubicSpline1D(t, y);

		const x = 2;
		const h = 1e-5;
		const numeric = (spline.evaluate(x + h) - spline.evaluate(x - h)) / (2 * h);
		expect(spline.derivative(x)).toBeCloseTo(numeric, 3);
	});

	it('analytic second derivative matches a central finite-difference of the first derivative', () => {
		const t = [0, 1, 2.5, 4, 6];
		const y = [0, 3, -1, 2, 5];
		const spline = fitNaturalCubicSpline1D(t, y);

		const x = 2;
		const h = 1e-5;
		const numeric = (spline.derivative(x + h) - spline.derivative(x - h)) / (2 * h);
		expect(spline.secondDerivative(x)).toBeCloseTo(numeric, 2);
	});

	it('does not produce NaN for coincident/near-coincident control points', () => {
		const t = [0, 1, 1, 2];
		const y = [0, 1, 1, 0];
		const spline = fitNaturalCubicSpline1D(t, y);

		expect(Number.isFinite(spline.evaluate(0.5))).toBe(true);
		expect(Number.isFinite(spline.evaluate(1.5))).toBe(true);
	});
});
