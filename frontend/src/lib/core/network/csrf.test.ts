import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCSRFToken } from './csrf';

beforeEach(() => {
	vi.stubGlobal('window', {});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('getCSRFToken', () => {
	it('reads the token from the csrftoken cookie', () => {
		vi.stubGlobal('document', { cookie: 'other=1; csrftoken=from-cookie; more=2' });

		expect(getCSRFToken()).toBe('from-cookie');
	});

	it('prefers the cookie over window.CSRF_TOKEN when both are present', () => {
		vi.stubGlobal('document', { cookie: 'csrftoken=from-cookie' });
		vi.stubGlobal('window', { CSRF_TOKEN: 'from-window' });

		expect(getCSRFToken()).toBe('from-cookie');
	});

	it('falls back to window.CSRF_TOKEN when no cookie is set', () => {
		vi.stubGlobal('document', { cookie: '' });
		vi.stubGlobal('window', { CSRF_TOKEN: 'from-window' });

		expect(getCSRFToken()).toBe('from-window');
	});

	it('returns null when neither the cookie nor window.CSRF_TOKEN are set', () => {
		vi.stubGlobal('document', { cookie: '' });

		expect(getCSRFToken()).toBeNull();
	});

	it('falls back to window.CSRF_TOKEN in a non-DOM context where document is undefined (e.g. SSR)', () => {
		// No document stub here — `document` is genuinely undefined in this Node test environment.
		vi.stubGlobal('window', { CSRF_TOKEN: 'from-window' });

		expect(getCSRFToken()).toBe('from-window');
	});
});
