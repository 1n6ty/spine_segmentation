import { describe, it, expect } from 'vitest';
import { gaussLegendre4 } from './gauss-legendre';

describe('gaussLegendre4', () => {
	it('integrates a constant exactly', () => {
		expect(gaussLegendre4(() => 3, 0, 2)).toBeCloseTo(6, 10);
	});

	it('integrates a cubic exactly (4-point Gauss-Legendre is exact up to degree 7)', () => {
		// integral of x^3 from 0 to 2 = 4
		expect(gaussLegendre4((x) => x ** 3, 0, 2)).toBeCloseTo(4, 10);
	});

	it('matches a known transcendental integral closely (sin(x) from 0 to pi = 2)', () => {
		expect(gaussLegendre4((x) => Math.sin(x), 0, Math.PI)).toBeCloseTo(2, 4);
	});

	it('is 0 over a zero-width interval', () => {
		expect(gaussLegendre4((x) => x ** 2, 5, 5)).toBe(0);
	});
});
