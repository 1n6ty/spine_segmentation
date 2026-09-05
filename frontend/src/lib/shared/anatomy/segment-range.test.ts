import { describe, it, expect } from 'vitest';
import { expand_vertebra_id_range, sort_segments_by_vertebra } from './segment-range';

describe('expand_vertebra_id_range', () => {
	it('matches REGIONS.ids exactly for the cervical range', () => {
		expect(expand_vertebra_id_range('C2', 'C7')).toEqual(['C7', 'C6', 'C5', 'C4', 'C3', 'C2']);
	});

	it('matches REGIONS.ids exactly for the thoracic range', () => {
		expect(expand_vertebra_id_range('Th1', 'Th12')).toEqual([
			'Th12',
			'Th11',
			'Th10',
			'Th9',
			'Th8',
			'Th7',
			'Th6',
			'Th5',
			'Th4',
			'Th3',
			'Th2',
			'Th1'
		]);
	});

	it('matches REGIONS.ids exactly for the lumbar range', () => {
		expect(expand_vertebra_id_range('L1', 'S1')).toEqual(['S1', 'L5', 'L4', 'L3', 'L2', 'L1']);
	});

	it('handles a single-vertebra range', () => {
		expect(expand_vertebra_id_range('C4', 'C4')).toEqual(['C4']);
	});

	it('returns null for a reversed range', () => {
		expect(expand_vertebra_id_range('C7', 'C2')).toBeNull();
	});

	it('returns null for an unknown id', () => {
		expect(expand_vertebra_id_range('C1', 'C7')).toBeNull();
		expect(expand_vertebra_id_range('C2', 'nonsense')).toBeNull();
	});
});

describe('sort_segments_by_vertebra', () => {
	it('orders segments by their most-inferior endpoint, superior first', () => {
		const defs = [
			{ id: 'a', bottomId: 'Th12' },
			{ id: 'b', bottomId: 'C6' },
			{ id: 'c', bottomId: 'Th2' }
		];

		expect(sort_segments_by_vertebra(defs).map((d) => d.id)).toEqual(['b', 'c', 'a']);
	});

	it('does not mutate the input array', () => {
		const defs = [
			{ id: 'a', bottomId: 'Th12' },
			{ id: 'b', bottomId: 'C6' }
		];
		const copy = [...defs];

		sort_segments_by_vertebra(defs);

		expect(defs).toEqual(copy);
	});
});
