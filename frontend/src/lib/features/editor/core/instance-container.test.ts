import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { InstanceContainer } from './instance-container.svelte';
import { SessionService } from '$lib/core/session/session.svelte';

let session: SessionService;

beforeEach(async () => {
	session = new SessionService(null);
	await session.loadingPromise;
});

describe('InstanceContainer', () => {
	it('composes a ViewportController (nav) and ToolController (tools)', () => {
		const container = new InstanceContainer('side', session);

		expect(container.nav).toBeDefined();
		expect(container.tools).toBeDefined();
		expect(container.mainCanvas).toBeNull();
		expect(container.miniCanvas).toBeNull();
	});

	it('stores the given projection and session', () => {
		const container = new InstanceContainer('frontal', session);
		expect(container.projection).toBe('frontal');
		expect(container.session).toBe(session);
	});

	it('refresh() clears both the viewport and tool controllers', () => {
		const container = new InstanceContainer('side', session);
		const nav_clear = vi.spyOn(container.nav, 'clear');
		const tools_clear = vi.spyOn(container.tools, 'clear');

		container.refresh();

		expect(nav_clear).toHaveBeenCalled();
		expect(tools_clear).toHaveBeenCalled();
	});
});
