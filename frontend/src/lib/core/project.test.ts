import { describe, it, expect, vi } from 'vitest';

// registry.svelte.ts's singleton fires an eager refresh() the moment it's
// imported (via project.svelte.ts below) -- mock the network client so that
// hits a resolved mock instead of Node's real fetch (which can't resolve a
// relative "/api/..." URL outside a browser and would just log a caught error).
vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

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

describe('project.enterBareRoute', () => {
	it('deselects an active session, unconditionally -- no cold-start exception', () => {
		project.resetSession('42');
		project.session.loadingPromise.catch(() => {}); // mocked network 404s -- irrelevant here
		expect(project.session.requestedUID).toBe('42');

		project.enterBareRoute();

		expect(project.session.sessionUID).toBe('');
		expect(project.session.requestedUID).toBeNull();
	});

	it('is a no-op when the session is already empty', () => {
		project.resetSession();
		const before = project.session;

		project.enterBareRoute();

		expect(project.session).toBe(before);
	});
});
