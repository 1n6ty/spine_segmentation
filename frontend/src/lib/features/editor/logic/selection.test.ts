import { describe, it, expect } from 'vitest';
import { getPointAndPolygonUnderCursor } from './selection';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

const square: Polygon = {
	uuid: 'u1',
	id: 'L5',
	points: [
		{ x: 0, y: 0 },
		{ x: 0, y: 10 },
		{ x: 10, y: 10 },
		{ x: 10, y: 0 }
	]
};

describe('getPointAndPolygonUnderCursor', () => {
	it('returns the vertex, its index, and polygon when the cursor is within hit radius of a vertex', () => {
		const result = getPointAndPolygonUnderCursor({ x: 0.5, y: 0.5 }, [square], 2);
		expect(result.point).toEqual({ x: 0, y: 0 });
		expect(result.indexInPolygon).toBe(0);
		expect(result.polygon).toBe(square);
	});

	it('returns the polygon with a null point/index when the cursor is inside the body but not near a vertex', () => {
		const result = getPointAndPolygonUnderCursor({ x: 5, y: 5 }, [square], 1);
		expect(result.point).toBeNull();
		expect(result.indexInPolygon).toBeNull();
		expect(result.polygon).toBe(square);
	});

	it('returns all nulls when the cursor hits neither a vertex nor a polygon body', () => {
		const result = getPointAndPolygonUnderCursor({ x: 100, y: 100 }, [square], 1);
		expect(result.point).toBeNull();
		expect(result.indexInPolygon).toBeNull();
		expect(result.polygon).toBeNull();
	});

	it('checks polygons in reverse order, so a later (topmost) polygon wins on overlap', () => {
		const overlapping: Polygon = {
			uuid: 'u2',
			id: 'L4',
			points: [
				{ x: 0, y: 0 },
				{ x: 0, y: 10 },
				{ x: 10, y: 10 },
				{ x: 10, y: 0 }
			]
		};
		const result = getPointAndPolygonUnderCursor({ x: 0.5, y: 0.5 }, [square, overlapping], 2);
		expect(result.polygon).toBe(overlapping);
	});

	it('returns all nulls for an empty polygon list', () => {
		const result = getPointAndPolygonUnderCursor({ x: 0, y: 0 }, [], 5);
		expect(result.polygon).toBeNull();
	});
});
