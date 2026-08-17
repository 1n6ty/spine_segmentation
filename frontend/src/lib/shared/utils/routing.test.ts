import { describe, it, expect } from 'vitest';
import { current_research_tab, research_url } from './routing';

describe('current_research_tab', () => {
	it('picks out the tab a pathname ends with', () => {
		expect(current_research_tab('/en/researches/7/edit')).toBe('edit');
		expect(current_research_tab('/en/researches/7/measure')).toBe('measure');
		expect(current_research_tab('/en/researches/7/report')).toBe('report');
		expect(current_research_tab('/en/researches/7/patient')).toBe('patient');
		expect(current_research_tab('/en/patient')).toBe('patient');
	});

	it('defaults to patient for a pathname with no recognized tab (e.g. the bare landing page)', () => {
		expect(current_research_tab('/en')).toBe('patient');
		expect(current_research_tab('/en/')).toBe('patient');
	});
});

describe('research_url', () => {
	it('builds a researches/{id}/{tab} URL, preserving the current tab', () => {
		expect(research_url('en', '7', '/en/researches/3/edit')).toBe('/en/researches/7/edit');
	});

	it('defaults to the patient tab when the current pathname has no tab segment', () => {
		expect(research_url('en', '7', '/en')).toBe('/en/researches/7/patient');
	});
});
