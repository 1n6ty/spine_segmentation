import { describe, it, expect } from 'vitest';
import { DEFAULT_SEGMENT_DEFINITIONS, REGIONS, match_items_by_ids } from './regions';

describe('REGIONS', () => {
	it('defines cervical, thoracic, and lumbar, in that order', () => {
		expect(REGIONS.map((r) => r.id)).toEqual(['cervical', 'thoracic', 'lumbar']);
	});

	it('lumbar includes S1 -- the clinical "global lumbar lordosis" range, not just L1-L5', () => {
		const lumbar = REGIONS.find((r) => r.id === 'lumbar')!;
		expect(lumbar.ids).toContain('S1');
		expect(lumbar.ids).toHaveLength(6);
	});

	it('cervical and thoracic ids cover their expected vertebra ranges', () => {
		expect(REGIONS.find((r) => r.id === 'cervical')!.ids).toEqual([
			'C7',
			'C6',
			'C5',
			'C4',
			'C3',
			'C2'
		]);
		expect(REGIONS.find((r) => r.id === 'thoracic')!.ids).toHaveLength(12);
	});

	it('every region has a localized label for both supported locales', () => {
		for (const region of REGIONS) {
			expect(region.label['en-US']).toBeTruthy();
			expect(region.label['ru-RU']).toBeTruthy();
		}
	});
});

describe('DEFAULT_SEGMENT_DEFINITIONS', () => {
	it('has one definition per region, with the expected top/bottom vertebra ids', () => {
		expect(DEFAULT_SEGMENT_DEFINITIONS).toHaveLength(3);
		expect(DEFAULT_SEGMENT_DEFINITIONS).toEqual(
			expect.arrayContaining([
				{ id: 'cervical', topId: 'C2', bottomId: 'C7' },
				{ id: 'thoracic', topId: 'Th1', bottomId: 'Th12' },
				{ id: 'lumbar', topId: 'L1', bottomId: 'S1' }
			])
		);
	});
});

describe('match_items_by_ids', () => {
	it('returns items reordered to match the requested id order', () => {
		const items = [
			{ id: 'a', v: 1 },
			{ id: 'b', v: 2 },
			{ id: 'c', v: 3 }
		];
		expect(match_items_by_ids(items, ['c', 'a'])).toEqual([
			{ id: 'c', v: 3 },
			{ id: 'a', v: 1 }
		]);
	});

	it('returns null if any requested id is missing', () => {
		const items = [{ id: 'a', v: 1 }];
		expect(match_items_by_ids(items, ['a', 'b'])).toBeNull();
	});

	it('returns an empty array for an empty id list', () => {
		expect(match_items_by_ids([{ id: 'a' }], [])).toEqual([]);
	});

	it('ignores items whose id was not requested', () => {
		const items = [
			{ id: 'a', v: 1 },
			{ id: 'z', v: 99 }
		];
		expect(match_items_by_ids(items, ['a'])).toEqual([{ id: 'a', v: 1 }]);
	});
});
