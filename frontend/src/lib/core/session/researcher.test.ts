import { describe, it, expect, afterEach } from 'vitest';
import { researcherService } from './researcher.svelte';

afterEach(() => {
	researcherService.email = null;
	researcherService.fullName = null;
	researcherService.password = null;
	researcherService.duty = null;
});

describe('researcherService', () => {
	it('starts with every field null', () => {
		expect(researcherService.email).toBeNull();
		expect(researcherService.fullName).toBeNull();
		expect(researcherService.password).toBeNull();
		expect(researcherService.duty).toBeNull();
	});

	it('is a shared singleton -- mutations are visible through every reference to it', () => {
		researcherService.fullName = 'Dr. Jane Doe';
		researcherService.email = 'jane@example.com';
		researcherService.duty = 'Doctor';

		expect(researcherService.fullName).toBe('Dr. Jane Doe');
		expect(researcherService.email).toBe('jane@example.com');
		expect(researcherService.duty).toBe('Doctor');
	});
});
