import { describe, it, expect } from 'vitest';
import {
	centroid,
	get_signed_angle,
	distance,
	vector_sub,
	dot_product,
	to_degrees,
	get_arc_radius,
	get_arc_center,
	get_midpoint,
	screen_to_world,
	is_point_in_polygon,
	aabb_of_points,
	aabb_overlaps
} from './geometry';

describe('centroid', () => {
	it('averages a set of points', () => {
		expect(
			centroid([
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 5, y: 10 }
			])
		).toEqual({ x: 5, y: 10 / 3 });
	});
});

describe('get_signed_angle', () => {
	it('is 0 for parallel vectors', () => {
		expect(get_signed_angle({ x: 1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
	});

	it('is positive for a CCW rotation and negative for CW (opposite signs)', () => {
		const ccw = get_signed_angle({ x: 1, y: 0 }, { x: 0, y: 1 });
		const cw = get_signed_angle({ x: 1, y: 0 }, { x: 0, y: -1 });
		expect(Math.sign(ccw)).not.toBe(Math.sign(cw));
	});
});

describe('distance', () => {
	it('computes the straight-line distance between two points', () => {
		expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
	});

	it('is 0 for identical points', () => {
		expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
	});
});

describe('vector_sub', () => {
	it('returns the vector difference', () => {
		expect(vector_sub({ x: 5, y: 5 }, { x: 2, y: 1 })).toEqual({ x: 3, y: 4 });
	});
});

describe('dot_product', () => {
	it('is 0 for perpendicular vectors', () => {
		expect(dot_product({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(0);
	});

	it('multiplies and sums components for general vectors', () => {
		expect(dot_product({ x: 2, y: 3 }, { x: 4, y: 5 })).toBe(23);
	});
});

describe('to_degrees', () => {
	it('converts radians to degrees', () => {
		expect(to_degrees(Math.PI)).toBeCloseTo(180);
		expect(to_degrees(Math.PI / 2)).toBeCloseTo(90);
	});
});

describe('get_arc_radius / get_arc_center', () => {
	// Circle x^2+y^2+ax+by+c=0 centered at origin with radius 5: c=-25, a=0, b=0
	it('recovers the radius and center from circle-fit coefficients', () => {
		const abc: [number, number, number] = [-25, 0, 0];
		expect(get_arc_radius(abc)).toBeCloseTo(5);
		const center = get_arc_center(abc);
		expect(center.x).toBeCloseTo(0);
		expect(center.y).toBeCloseTo(0);
	});

	it('clamps to 0 rather than producing NaN when the discriminant would be negative', () => {
		const abc: [number, number, number] = [100, 0, 0]; // a^2+b^2-4c = -400
		expect(get_arc_radius(abc)).toBe(0);
	});
});

describe('get_midpoint', () => {
	it('returns the average of two points', () => {
		expect(get_midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
	});
});

describe('screen_to_world', () => {
	it('inverts an offset+scale transform', () => {
		expect(screen_to_world({ x: 110, y: 60 }, { x: 10, y: 10 }, 2)).toEqual({ x: 50, y: 25 });
	});

	it('is the identity transform when offset is zero and scale is 1', () => {
		expect(screen_to_world({ x: 42, y: 7 }, { x: 0, y: 0 }, 1)).toEqual({ x: 42, y: 7 });
	});
});

describe('is_point_in_polygon', () => {
	const square = [
		{ x: 0, y: 0 },
		{ x: 10, y: 0 },
		{ x: 10, y: 10 },
		{ x: 0, y: 10 }
	];

	it('returns true for a point inside the polygon', () => {
		expect(is_point_in_polygon({ x: 5, y: 5 }, square)).toBe(true);
	});

	it('returns false for a point outside the polygon', () => {
		expect(is_point_in_polygon({ x: 50, y: 50 }, square)).toBe(false);
	});

	it('returns false for a point outside along both axes', () => {
		expect(is_point_in_polygon({ x: -5, y: -5 }, square)).toBe(false);
	});
});

describe('aabb_of_points', () => {
	it('computes the bounding box of a single point (zero-area)', () => {
		expect(aabb_of_points([{ x: 3, y: 4 }])).toEqual({ minX: 3, minY: 4, maxX: 3, maxY: 4 });
	});

	it('computes the bounding box of multiple points', () => {
		expect(
			aabb_of_points([
				{ x: 0, y: 5 },
				{ x: 10, y: -2 },
				{ x: -3, y: 8 }
			])
		).toEqual({ minX: -3, minY: -2, maxX: 10, maxY: 8 });
	});
});

describe('aabb_overlaps', () => {
	const box = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

	it('is true for overlapping boxes', () => {
		expect(aabb_overlaps(box, { minX: 5, minY: 5, maxX: 15, maxY: 15 })).toBe(true);
	});

	it('is true when boxes only touch at an edge (inclusive)', () => {
		expect(aabb_overlaps(box, { minX: 10, minY: 0, maxX: 20, maxY: 10 })).toBe(true);
	});

	it('is false for disjoint boxes', () => {
		expect(aabb_overlaps(box, { minX: 20, minY: 20, maxX: 30, maxY: 30 })).toBe(false);
	});

	it('is true when one box fully contains the other', () => {
		expect(aabb_overlaps(box, { minX: 2, minY: 2, maxX: 8, maxY: 8 })).toBe(true);
	});
});
