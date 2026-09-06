import { describe, it, expect } from 'vitest';
import { REGIONS, THORACIC_SUBREGIONS, match_items_by_ids } from './regions';

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

describe('THORACIC_SUBREGIONS', () => {
	it('defines upper, mid, and lower, in that order', () => {
		expect(THORACIC_SUBREGIONS.map((r) => r.id)).toEqual([
			'thoracic-upper',
			'thoracic-mid',
			'thoracic-lower'
		]);
		expect(THORACIC_SUBREGIONS.map((r) => r.subArcId)).toEqual(['upper', 'mid', 'lower']);
	});

	it('covers the expected vertebra ranges, inferior->superior', () => {
		expect(THORACIC_SUBREGIONS[0].ids).toEqual(['Th5', 'Th4', 'Th3', 'Th2', 'Th1']);
		expect(THORACIC_SUBREGIONS[1].ids).toEqual(['Th9', 'Th8', 'Th7', 'Th6']);
		expect(THORACIC_SUBREGIONS[2].ids).toEqual(['Th12', 'Th11', 'Th10']);
	});

	it('has the expected vertebraeLabel per sub-region', () => {
		expect(THORACIC_SUBREGIONS.map((r) => r.vertebraeLabel)).toEqual([
			'Th1-Th5',
			'Th6-Th9',
			'Th10-Th12'
		]);
	});

	it('does not modify REGIONS', () => {
		expect(REGIONS.map((r) => r.id)).toEqual(['cervical', 'thoracic', 'lumbar']);
	});

	it('every sub-region has a localized label for both supported locales', () => {
		for (const sub of THORACIC_SUBREGIONS) {
			expect(sub.label['en-US']).toBeTruthy();
			expect(sub.label['ru-RU']).toBeTruthy();
		}
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
