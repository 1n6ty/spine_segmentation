import { authService } from './auth.svelte';

/** Codename must match the backend's app-label-qualified format exactly, e.g.
 * 'Dicom.access_studies' -- see common/schemas/v1/domain/user.py's
 * User_Item_Schema.permissions docstring for the wire format. */
export function hasPermission(codename: string): boolean {
	return authService.permissions.includes(codename);
}
