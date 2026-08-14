import { describe, it, expect } from 'vitest';
import { orderAndName } from './orderer';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

function square_at(id: string, cx: number, cy: number): Polygon {
	const h = 5;
	return {
		uuid: id,
		id,
		points: [
			{ x: cx - h, y: cy + h },
			{ x: cx - h, y: cy - h },
			{ x: cx + h, y: cy - h },
			{ x: cx + h, y: cy + h }
		]
	};
}

describe('orderAndName', () => {
	it('returns an empty array unchanged', () => {
		expect(orderAndName([])).toEqual([]);
	});

	it('clears the id of a single polygon and returns it unchanged otherwise', () => {
		const single = square_at('x', 0, 0);
		const result = orderAndName([single]);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('');
		expect(result[0].points).toHaveLength(4);
	});

	it('orders multiple polygons bottom-up (highest y first) and assigns S1..C2 names', () => {
		// Three polygons stacked vertically — bottom (highest y) should be named S1 first.
		const bottom = square_at('a', 0, 400);
		const middle = square_at('b', 0, 200);
		const top = square_at('c', 0, 0);

		const result = orderAndName([top, middle, bottom]);

		expect(result).toHaveLength(3);
		const ids = result.map((p) => p.id);
		expect(ids).toContain('S1');
		expect(ids).toContain('L5');
		expect(ids).toContain('L4');
	});

	it('normalizes point order to the [bottom-left, top-left, top-right, bottom-right] convention regardless of input order', () => {
		const b = square_at('b', 0, 200);
		const shuffled_b: Polygon = {
			...b,
			points: [b.points[2], b.points[3], b.points[0], b.points[1]]
		};

		const result_original = orderAndName([square_at('a2', 0, 400), b]);
		const result_shuffled = orderAndName([square_at('a3', 0, 400), shuffled_b]);

		const original_points = result_original.find((p) => p.id === 'L5')?.points;
		const shuffled_points = result_shuffled.find((p) => p.id === 'L5')?.points;
		expect(shuffled_points).toEqual(original_points);
	});
});
