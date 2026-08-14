import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { project } from './project.svelte';

describe('project', () => {
	it('exposes session, researcher, and registry as a single entrypoint', () => {
		expect(project.session).toBeDefined();
		expect(project.researcher).toBeDefined();
		expect(project.registry).toBeDefined();
	});

	it('mutations on project.researcher reflect through the shared singleton', () => {
		project.researcher.fullName = 'Dr. Test';
		expect(project.researcher.fullName).toBe('Dr. Test');
		project.researcher.fullName = null;
	});
});
