import { describe, it, expect, vi, beforeEach } from 'vitest';

const { get, patch } = vi.hoisted(() => ({
	get: vi.fn(),
	patch: vi.fn()
}));
vi.mock('$lib/core/network/client', () => ({ get, patch }));

import { fetchProfile, updateProfile, ProfilePatchError } from './api';

beforeEach(() => {
	get.mockReset();
	patch.mockReset();
});

describe('fetchProfile', () => {
	it('unwraps body.data from a successful response', async () => {
		get.mockResolvedValue({
			ok: true,
			json: async () => ({ data: { id: 1, first_name: 'Jane' } })
		});

		const profile = await fetchProfile();

		expect(get).toHaveBeenCalledWith('/api/profiles/me/');
		expect(profile).toEqual({ id: 1, first_name: 'Jane' });
	});

	it('throws on a non-ok response', async () => {
		get.mockResolvedValue({ ok: false, status: 401 });

		await expect(fetchProfile()).rejects.toThrow('401');
	});
});

describe('updateProfile', () => {
	it('returns the updated profile on success', async () => {
		patch.mockResolvedValue({
			ok: true,
			json: async () => ({ data: { id: 1, first_name: 'New' } })
		});

		const profile = await updateProfile(1, { first_name: 'New' });

		expect(patch).toHaveBeenCalledWith('/api/profiles/1/', { json: { first_name: 'New' } });
		expect(profile).toEqual({ id: 1, first_name: 'New' });
	});

	it('throws a ProfilePatchError carrying the response details on a 400', async () => {
		patch.mockResolvedValue({
			ok: false,
			json: async () => ({
				details: [{ field: 'first_name', message: 'This field is required.' }]
			})
		});

		await expect(updateProfile(1, { first_name: '' })).rejects.toThrow(ProfilePatchError);
		try {
			await updateProfile(1, { first_name: '' });
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(ProfilePatchError);
			expect((err as ProfilePatchError).fieldErrors).toEqual([
				{ field: 'first_name', message: 'This field is required.' }
			]);
		}
	});

	it('falls back to a generic field error when the response has no details', async () => {
		patch.mockResolvedValue({ ok: false, json: async () => ({}) });

		try {
			await updateProfile(1, { first_name: '' });
			expect.unreachable();
		} catch (err) {
			expect(err).toBeInstanceOf(ProfilePatchError);
			expect((err as ProfilePatchError).fieldErrors).toEqual([
				{ field: null, message: 'Update failed.' }
			]);
		}
	});
});
