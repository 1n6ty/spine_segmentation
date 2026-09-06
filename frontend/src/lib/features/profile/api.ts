import { get, patch } from '$lib/core/network/client';
import type { Profile, ProfilePatchFields } from './types';

export async function fetchProfile(): Promise<Profile> {
	const res = await get('/api/profiles/me/');
	if (!res.ok) throw new Error(`GET /api/profiles/me/ failed with ${res.status}`);
	const body = await res.json();
	return body.data as Profile;
}

export type ProfileFieldError = { field: string | null; message: string };

/** Carries the backend's per-field `details` array -- patch_json() (client.ts)
 * throws a bare Error with no parsed body on non-2xx, which loses this, so
 * updateProfile() below deliberately uses patch() (raw Response) instead and
 * parses the body itself regardless of status. */
export class ProfilePatchError extends Error {
	fieldErrors: ProfileFieldError[];

	constructor(fieldErrors: ProfileFieldError[]) {
		super(fieldErrors.map((e) => e.message).join(' '));
		this.fieldErrors = fieldErrors;
	}
}

export async function updateProfile(id: number, fields: ProfilePatchFields): Promise<Profile> {
	const res = await patch(`/api/profiles/${id}/`, { json: fields });
	const body = await res.json();
	if (!res.ok) {
		throw new ProfilePatchError(body.details ?? [{ field: null, message: 'Update failed.' }]);
	}
	return body.data as Profile;
}
