import { describe, it, expect } from 'vitest';
import { VERTEBRA_ORDER, vertebra_order_index } from './vertebra-order';

describe('VERTEBRA_ORDER', () => {
	it('has exactly 24 vertebrae', () => {
		expect(VERTEBRA_ORDER).toHaveLength(24);
	});

	it('starts at C2 and ends at S1', () => {
		expect(VERTEBRA_ORDER[0]).toBe('C2');
		expect(VERTEBRA_ORDER.at(-1)).toBe('S1');
	});

	it('never includes C1', () => {
		expect(VERTEBRA_ORDER).not.toContain('C1');
	});

	it('has no duplicates', () => {
		expect(new Set(VERTEBRA_ORDER).size).toBe(VERTEBRA_ORDER.length);
	});
});

describe('vertebra_order_index', () => {
	it('returns the index of a known vertebra', () => {
		expect(vertebra_order_index('C2')).toBe(0);
		expect(vertebra_order_index('S1')).toBe(23);
	});

	it('returns -1 for an unknown id', () => {
		expect(vertebra_order_index('C1')).toBe(-1);
		expect(vertebra_order_index('nonsense')).toBe(-1);
	});
});
