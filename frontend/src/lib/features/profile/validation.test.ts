import { describe, it, expect } from 'vitest';
import { validatePersonalInfo } from './validation';

describe('validatePersonalInfo', () => {
	it('returns no errors when both names are filled', () => {
		expect(validatePersonalInfo({ first_name: 'Jane', last_name: 'Doe' })).toEqual({});
	});

	it('flags an empty first name', () => {
		expect(validatePersonalInfo({ first_name: '', last_name: 'Doe' })).toEqual({
			first_name: 'required'
		});
	});

	it('flags an empty last name', () => {
		expect(validatePersonalInfo({ first_name: 'Jane', last_name: '' })).toEqual({
			last_name: 'required'
		});
	});

	it('flags a whitespace-only name as empty', () => {
		expect(validatePersonalInfo({ first_name: '   ', last_name: 'Doe' })).toEqual({
			first_name: 'required'
		});
	});

	it('flags both names when both are empty', () => {
		expect(validatePersonalInfo({ first_name: '', last_name: '' })).toEqual({
			first_name: 'required',
			last_name: 'required'
		});
	});
});
