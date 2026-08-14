import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('$lib/core/network/client', () => ({ get }));

import { authService } from './auth.svelte';
import { registry } from './registry.svelte';
import { researcherService } from './researcher.svelte';

function mock_me_response(overrides: Partial<Record<string, unknown>> = {}) {
	get.mockResolvedValue({
		ok: true,
		json: async () => ({
			data: {
				id: 1,
				email: 'doctor@example.com',
				first_name: 'Jane',
				last_name: 'Doe',
				role: { slug: 'doctor', name: 'Doctor' },
				...overrides
			}
		})
	});
}

beforeEach(() => {
	get.mockReset();
});

afterEach(() => {
	authService.reject();
});

describe('authService.verify', () => {
	it('requests /api/profiles/me/ and marks authenticated on a 200', async () => {
		mock_me_response();

		const ok = await authService.verify();

		expect(get).toHaveBeenCalledWith('/api/profiles/me/');
		expect(ok).toBe(true);
		expect(authService.status).toBe('authenticated');
	});

	it('populates researcher identity from the response', async () => {
		mock_me_response();

		await authService.verify();

		expect(researcherService.email).toBe('doctor@example.com');
		expect(researcherService.fullName).toBe('Jane Doe');
	});

	it('populates researcher duty from the role name', async () => {
		mock_me_response({ role: { slug: 'admin', name: 'Administrator' } });

		await authService.verify();

		expect(researcherService.duty).toBe('Administrator');
	});

	it('leaves duty null when the profile has no role', async () => {
		mock_me_response({ role: null });

		await authService.verify();

		expect(researcherService.duty).toBeNull();
	});

	it('falls back to email for fullName when first/last name are both empty', async () => {
		mock_me_response({ first_name: '', last_name: '' });

		await authService.verify();

		expect(researcherService.fullName).toBe('doctor@example.com');
	});

	it('namespaces the session registry to the verified account id', async () => {
		mock_me_response({ id: 42 });

		await authService.verify();

		expect(registry.accountId).toBe('42');
	});

	it('rejects (401/non-ok) clears identity and returns false', async () => {
		get.mockResolvedValue({ ok: false });

		const ok = await authService.verify();

		expect(ok).toBe(false);
		expect(authService.status).toBe('unauthenticated');
		expect(researcherService.email).toBeNull();
		expect(registry.accountId).toBeNull();
	});

	it('treats a network error the same as an unauthenticated response', async () => {
		get.mockRejectedValue(new Error('network down'));

		const ok = await authService.verify();

		expect(ok).toBe(false);
		expect(authService.status).toBe('unauthenticated');
	});
});

describe('authService.reject', () => {
	it('clears status, researcher identity, and the registry account scope', async () => {
		mock_me_response();
		await authService.verify();

		authService.reject();

		expect(authService.status).toBe('unauthenticated');
		expect(researcherService.fullName).toBeNull();
		expect(researcherService.email).toBeNull();
		expect(researcherService.duty).toBeNull();
		expect(registry.accountId).toBeNull();
	});
});
