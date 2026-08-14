import { describe, it, expect } from 'vitest';
import { format_json_to_polygons } from './ref-points';

describe('format_json_to_polygons', () => {
	it('converts backend vertebrae points into polygons named by vertebra id', () => {
		const polygons = format_json_to_polygons({
			vertebraes: [
				{
					name: 'L5',
					points: [
						[1, 2],
						[3, 4],
						[5, 6],
						[7, 8]
					]
				}
			]
		});

		expect(polygons).toHaveLength(1);
		expect(polygons[0].id).toBe('L5');
		expect(polygons[0].points).toEqual([
			{ x: 1, y: 2 },
			{ x: 3, y: 4 },
			{ x: 5, y: 6 },
			{ x: 7, y: 8 }
		]);
		expect(polygons[0].uuid).toBeTruthy();
	});

	it('returns an empty array for an empty vertebrae list', () => {
		expect(format_json_to_polygons({ vertebraes: [] })).toEqual([]);
	});
});
