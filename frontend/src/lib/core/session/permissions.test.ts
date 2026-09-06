import { describe, it, expect, afterEach } from 'vitest';

import { authService } from './auth.svelte';
import { hasPermission } from './permissions.svelte';

afterEach(() => {
	authService.reject();
});

describe('hasPermission', () => {
	it('returns false when the codename is not in authService.permissions', () => {
		authService.permissions = ['Company.view_company'];

		expect(hasPermission('Dicom.access_studies')).toBe(false);
	});

	it('returns true when the codename is in authService.permissions', () => {
		authService.permissions = ['Dicom.access_studies', 'Company.view_company'];

		expect(hasPermission('Dicom.access_studies')).toBe(true);
	});

	it('returns false when authService.permissions is empty', () => {
		authService.permissions = [];

		expect(hasPermission('Dicom.access_studies')).toBe(false);
	});
});
