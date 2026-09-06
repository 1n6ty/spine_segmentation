import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { get } = vi.hoisted(() => ({
	// Sane default for registry.svelte's eager, constructor-time refresh()
	// (fired the moment that module is first imported below).
	get: vi.fn().mockResolvedValue({ ok: false })
}));
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
				roles: [{ slug: 'doctor', name: 'Doctor' }],
				company: { slug: 'acme', name: 'Acme' },
				permissions: ['Dicom.access_studies'],
				...overrides
			}
		})
	});
}

beforeEach(() => {
	get.mockReset();
	registry.sessionValues = {};
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
		mock_me_response({ roles: [{ slug: 'admin', name: 'Administrator' }] });

		await authService.verify();

		expect(researcherService.duty).toBe('Administrator');
	});

	it('joins multiple role names for duty', async () => {
		mock_me_response({
			roles: [
				{ slug: 'doctor', name: 'Doctor' },
				{ slug: 'admin', name: 'Administrator' }
			]
		});

		await authService.verify();

		expect(researcherService.duty).toBe('Doctor, Administrator');
	});

	it('leaves duty null when the profile has no roles', async () => {
		mock_me_response({ roles: [] });

		await authService.verify();

		expect(researcherService.duty).toBeNull();
	});

	it('falls back to email for fullName when first/last name are both empty', async () => {
		mock_me_response({ first_name: '', last_name: '' });

		await authService.verify();

		expect(researcherService.fullName).toBe('doctor@example.com');
	});

	it('populates permissions and company from the response', async () => {
		mock_me_response({
			permissions: ['Dicom.access_studies', 'Company.view_company'],
			company: { slug: 'acme', name: 'Acme' }
		});

		await authService.verify();

		expect(authService.permissions).toEqual(['Dicom.access_studies', 'Company.view_company']);
		expect(authService.company).toEqual({ slug: 'acme', name: 'Acme' });
	});

	it('defaults permissions to [] and company to null when absent from the response', async () => {
		mock_me_response({ permissions: undefined, company: undefined });

		await authService.verify();

		expect(authService.permissions).toEqual([]);
		expect(authService.company).toBeNull();
	});

	it('refreshes the recent-studies registry on a confirmed login', async () => {
		mock_me_response({ id: 42 });
		const refresh_spy = vi.spyOn(registry, 'refresh');

		await authService.verify();

		expect(refresh_spy).toHaveBeenCalled();
		refresh_spy.mockRestore();
	});

	it('rejects (401/non-ok) clears identity and the registry', async () => {
		registry.sessionValues = { '1': {} as any };
		get.mockResolvedValue({ ok: false });

		const ok = await authService.verify();

		expect(ok).toBe(false);
		expect(authService.status).toBe('unauthenticated');
		expect(researcherService.email).toBeNull();
		expect(authService.permissions).toEqual([]);
		expect(authService.company).toBeNull();
		expect(registry.sessionValues).toEqual({});
	});

	it('treats a network error the same as an unauthenticated response', async () => {
		get.mockRejectedValue(new Error('network down'));

		const ok = await authService.verify();

		expect(ok).toBe(false);
		expect(authService.status).toBe('unauthenticated');
	});
});

describe('authService.reject', () => {
	it('clears status, researcher identity, and the registry', async () => {
		mock_me_response();
		await authService.verify();

		authService.reject();

		expect(authService.status).toBe('unauthenticated');
		expect(researcherService.fullName).toBeNull();
		expect(researcherService.email).toBeNull();
		expect(researcherService.duty).toBeNull();
		expect(authService.permissions).toEqual([]);
		expect(authService.company).toBeNull();
		expect(registry.sessionValues).toEqual({});
	});
});
