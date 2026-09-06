import { describe, it, expect } from 'vitest';
import { resolve_computed_regions } from './computed-segments';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';

/** A vertebra polygon whose bottom/top plate midpoints sit on the given circle at `degrees`
 * (+/- a small spread) -- mirrors `central-arc-segments.test.ts`'s fixture. */
function vertebra_on_circle(
	id: string,
	cx: number,
	cy: number,
	r: number,
	degrees: number
): Polygon {
	const spread = 3;
	const rad = (deg: number) => (deg * Math.PI) / 180;
	const at = (deg: number): Point => ({
		x: cx + r * Math.cos(rad(deg)),
		y: cy + r * Math.sin(rad(deg))
	});

	const bottom = at(degrees - spread / 2);
	const top = at(degrees + spread / 2);
	const perp = { x: -(top.y - bottom.y), y: top.x - bottom.x };
	const norm = Math.hypot(perp.x, perp.y) || 1;
	const half = { x: (perp.x / norm) * 2, y: (perp.y / norm) * 2 };

	return {
		uuid: id,
		id,
		points: [
			{ x: bottom.x - half.x, y: bottom.y - half.y },
			{ x: top.x - half.x, y: top.y - half.y },
			{ x: top.x + half.x, y: top.y + half.y },
			{ x: bottom.x + half.x, y: bottom.y + half.y }
		]
	};
}

function circle_fixture(): Polygon[] {
	const ids = ['S1', 'L5', 'L4', 'L3'];
	return ids.map((id, i) => vertebra_on_circle(id, 0, 0, 100, i * 10));
}

describe('resolve_computed_regions', () => {
	it('detects an arc and returns it as a kind: computed row', () => {
		const rows = resolve_computed_regions(circle_fixture(), []);

		expect(rows).toHaveLength(1);
		expect(rows[0].kind).toBe('computed');
		expect(rows[0].definitionId).toBe('computed:S1-L3');
		expect(rows[0].polygons.map((v) => v.id).sort()).toEqual(['L3', 'L4', 'L5', 'S1'].sort());
	});

	it('excludes a detected arc that exactly matches an excludeRanges entry (e.g. a Default Region)', () => {
		const rows = resolve_computed_regions(circle_fixture(), [{ topId: 'L3', bottomId: 'S1' }]);
		expect(rows).toEqual([]);
	});

	it('excludes a detected arc that exactly matches a current User-Defined segment', () => {
		const rows = resolve_computed_regions(circle_fixture(), [{ topId: 'L3', bottomId: 'S1' }]);
		expect(rows).toEqual([]);
	});

	it('is unaffected by an excludeRanges entry that does not match any detected arc', () => {
		const rows = resolve_computed_regions(circle_fixture(), [{ topId: 'C2', bottomId: 'C7' }]);
		expect(rows).toHaveLength(1);
	});

	it('returns nothing for too few annotated vertebrae', () => {
		expect(resolve_computed_regions([], [])).toEqual([]);
	});
});
