import { describe, it, expect } from 'vitest';
import {
	classifyRectSelection,
	getEntityUnderCursor,
	getPointAndPolygonUnderCursor
} from './selection';
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

// [bottom-left, top-left, top-right, bottom-right] per orderer.ts's convention -- unlike
// `square` above, laid out so LEFT_SIDE_INDICES=[0,1]/RIGHT_SIDE_INDICES=[2,3] mean something
// (left = x=0 edge, right = x=40 edge). Deliberately wide (half-width 20) so a center click sits
// comfortably outside any reasonable side-hit band.
function wide_square(uuid: string, cx: number, cy: number): Polygon {
	const hw = 20;
	const hh = 10;
	return {
		uuid,
		id: uuid,
		points: [
			{ x: cx - hw, y: cy + hh },
			{ x: cx - hw, y: cy - hh },
			{ x: cx + hw, y: cy - hh },
			{ x: cx + hw, y: cy + hh }
		]
	};
}

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

describe('getEntityUnderCursor', () => {
	const poly = wide_square('u1', 0, 0);

	it('returns a point entry within the vertex hit radius', () => {
		const result = getEntityUnderCursor({ x: -19.5, y: 9.5 }, [poly], 2, 4);
		expect(result).toEqual({ kind: 'point', polygonUuid: 'u1', pointIndex: 0 });
	});

	it('returns a side entry near the left edge, away from any vertex', () => {
		// Strictly inside the polygon body (x=-19, not exactly on the x=-20 edge) to avoid
		// boundary ambiguity in the point-in-polygon ray cast.
		const result = getEntityUnderCursor({ x: -19, y: 0 }, [poly], 2, 4);
		expect(result).toEqual({ kind: 'side', polygonUuid: 'u1', side: 'left' });
	});

	it('returns a side entry near the right edge', () => {
		const result = getEntityUnderCursor({ x: 19, y: 0 }, [poly], 2, 4);
		expect(result).toEqual({ kind: 'side', polygonUuid: 'u1', side: 'right' });
	});

	it('returns a vertebra entry when inside the body but outside the side band on both edges', () => {
		const result = getEntityUnderCursor({ x: 0, y: 0 }, [poly], 2, 4);
		expect(result).toEqual({ kind: 'vertebra', polygonUuid: 'u1' });
	});

	it('returns null on a miss', () => {
		const result = getEntityUnderCursor({ x: 1000, y: 1000 }, [poly], 2, 4);
		expect(result).toBeNull();
	});

	it('vertex hit-testing still takes priority over the side band', () => {
		// (-20, -10) is a vertex (top-left) AND within the side band of the left edge -- the
		// vertex tier runs first and must win.
		const result = getEntityUnderCursor({ x: -20, y: -10 }, [poly], 3, 4);
		expect(result).toEqual({ kind: 'point', polygonUuid: 'u1', pointIndex: 1 });
	});

	it('returns a side entry near the top edge (the plate between top-left and top-right)', () => {
		const result = getEntityUnderCursor({ x: 0, y: -10 }, [poly], 2, 4);
		expect(result).toEqual({ kind: 'side', polygonUuid: 'u1', side: 'top' });
	});

	it('returns a side entry near the bottom edge (the plate between bottom-left and bottom-right)', () => {
		const result = getEntityUnderCursor({ x: 0, y: 10 }, [poly], 2, 4);
		expect(result).toEqual({ kind: 'side', polygonUuid: 'u1', side: 'bottom' });
	});

	it('side hit-testing is NOT gated on being inside the polygon body -- a click just outside an edge still counts', () => {
		// x=-21 is 1 unit to the LEFT of the left edge (which sits at x=-20) -- outside the
		// polygon entirely, not just near its inner boundary.
		const result = getEntityUnderCursor({ x: -21, y: 0 }, [poly], 2, 4);
		expect(result).toEqual({ kind: 'side', polygonUuid: 'u1', side: 'left' });
	});

	it('the side band straddles the edge symmetrically: equal-distance hits just inside and just outside both register', () => {
		const inside = getEntityUnderCursor({ x: -17, y: 0 }, [poly], 2, 4); // 3 units inside
		const outside = getEntityUnderCursor({ x: -23, y: 0 }, [poly], 2, 4); // 3 units outside
		expect(inside).toEqual({ kind: 'side', polygonUuid: 'u1', side: 'left' });
		expect(outside).toEqual({ kind: 'side', polygonUuid: 'u1', side: 'left' });
	});
});

describe('classifyRectSelection', () => {
	it('classifies a vertebra as fully selected when all 4 points are enclosed', () => {
		const poly = wide_square('u1', 0, 0);
		const entries = classifyRectSelection([poly], { minX: -100, minY: -100, maxX: 100, maxY: 100 });
		expect(entries).toEqual([{ kind: 'vertebra', polygonUuid: 'u1' }]);
	});

	it('classifies exactly the left 2 points as a side selection', () => {
		const poly = wide_square('u1', 0, 0);
		const entries = classifyRectSelection([poly], { minX: -100, minY: -100, maxX: -10, maxY: 100 });
		expect(entries).toEqual([{ kind: 'side', polygonUuid: 'u1', side: 'left' }]);
	});

	it('classifies exactly the right 2 points as a side selection', () => {
		const poly = wide_square('u1', 0, 0);
		const entries = classifyRectSelection([poly], { minX: 10, minY: -100, maxX: 100, maxY: 100 });
		expect(entries).toEqual([{ kind: 'side', polygonUuid: 'u1', side: 'right' }]);
	});

	it('classifies a single enclosed point as a point selection, not rounded up to a side', () => {
		const poly = wide_square('u1', 0, 0);
		// Only the bottom-left point (index 0) falls in this box.
		const entries = classifyRectSelection([poly], { minX: -100, minY: 0, maxX: -10, maxY: 100 });
		expect(entries).toEqual([{ kind: 'point', polygonUuid: 'u1', pointIndex: 0 }]);
	});

	it('classifies exactly the top 2 points (top-left, top-right) as a top-side selection', () => {
		const poly = wide_square('u1', 0, 0);
		// Only top-left (index 1) and top-right (index 2) -- both at y = -10 -- fall in this box.
		const entries = classifyRectSelection([poly], { minX: -100, minY: -15, maxX: 100, maxY: -5 });
		expect(entries).toEqual([{ kind: 'side', polygonUuid: 'u1', side: 'top' }]);
	});

	it('classifies exactly the bottom 2 points (bottom-left, bottom-right) as a bottom-side selection', () => {
		const poly = wide_square('u1', 0, 0);
		// Only bottom-left (index 0) and bottom-right (index 3) -- both at y = 10 -- fall in this box.
		const entries = classifyRectSelection([poly], { minX: -100, minY: 5, maxX: 100, maxY: 15 });
		expect(entries).toEqual([{ kind: 'side', polygonUuid: 'u1', side: 'bottom' }]);
	});

	it('classifies a 3-point subset as individual points, not rounded up to a side or vertebra', () => {
		// For a perfectly axis-aligned rectangle (like `wide_square`), any 2 corners an AABB box
		// can isolate together always turn out to be one of the 4 real sides, and 3-corner
		// subsets aren't reachable at all (excluding one corner via x or y always drags out its
		// neighbor sharing that coordinate too) -- real vertebra quadrilaterals aren't perfect
		// rectangles, so use a skewed one here to reach this case at all.
		const skewed: Polygon = {
			uuid: 'u1',
			id: 'u1',
			points: [
				{ x: 0, y: 0 },
				{ x: 1, y: 10 },
				{ x: 50, y: 5 }, // far off on x -- the one point this box excludes
				{ x: 2, y: -5 }
			]
		};
		const entries = classifyRectSelection([skewed], {
			minX: -100,
			minY: -100,
			maxX: 10,
			maxY: 100
		});
		const sorted = [...entries].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
		expect(sorted).toEqual(
			[
				{ kind: 'point', polygonUuid: 'u1', pointIndex: 0 },
				{ kind: 'point', polygonUuid: 'u1', pointIndex: 1 },
				{ kind: 'point', polygonUuid: 'u1', pointIndex: 3 }
			].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
		);
	});

	it('skips a polygon with nothing enclosed', () => {
		const poly = wide_square('u1', 0, 0);
		const entries = classifyRectSelection([poly], {
			minX: 1000,
			minY: 1000,
			maxX: 2000,
			maxY: 2000
		});
		expect(entries).toEqual([]);
	});

	it('classifies multiple polygons independently', () => {
		const a = wide_square('a', 0, 0);
		const b = wide_square('b', 200, 0);
		const entries = classifyRectSelection([a, b], { minX: -100, minY: -100, maxX: 100, maxY: 100 });
		expect(entries).toEqual([{ kind: 'vertebra', polygonUuid: 'a' }]);
	});
});
