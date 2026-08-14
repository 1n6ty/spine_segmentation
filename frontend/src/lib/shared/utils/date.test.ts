import { describe, it, expect } from 'vitest';
import { get_age } from './date';

describe('get_age', () => {
	it('returns null for a missing birth date', () => {
		expect(get_age(null)).toBeNull();
		expect(get_age(undefined)).toBeNull();
	});

	it('computes age when the birthday has already occurred this year', () => {
		const today = new Date(2026, 5, 15); // June 15, 2026
		const birth_date = new Date(1990, 0, 1); // Jan 1, 1990
		expect(get_age(birth_date, today)).toBe(36);
	});

	it("subtracts one year when the birthday hasn't occurred yet this year", () => {
		const today = new Date(2026, 0, 1); // Jan 1, 2026
		const birth_date = new Date(1990, 5, 15); // June 15, 1990
		expect(get_age(birth_date, today)).toBe(35);
	});

	it('counts the birthday itself as already having occurred', () => {
		const today = new Date(2026, 5, 15);
		const birth_date = new Date(1990, 5, 15);
		expect(get_age(birth_date, today)).toBe(36);
	});

	it('returns null for a birth date in the future', () => {
		const today = new Date(2026, 0, 1);
		const birth_date = new Date(2027, 0, 1);
		expect(get_age(birth_date, today)).toBeNull();
	});
});
