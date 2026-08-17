import { test, expect } from '@playwright/test';
import { assertBackendReachable, login, DOCTOR } from './helpers';

test.beforeAll(async ({ request }) => {
	await assertBackendReachable(request);
});

test('visiting /login with a live session cookie redirects to the landing page instead of showing the form', async ({
	page
}) => {
	await login(page, DOCTOR);
	await expect(page).toHaveURL(/\/en\/?$/);

	// The sessionid cookie is HttpOnly (server-side SESSION_COOKIE_HTTPONLY) --
	// invisible to page.evaluate(() => document.cookie) -- but the browser
	// still attaches it automatically to this navigation, so /login's own
	// GET /api/profiles/me/ check picks it up the same way any other request
	// would.
	await page.goto('/en/login', { waitUntil: 'networkidle' });
	await expect(page).toHaveURL(/\/en\/?$/);

	// The login form itself must never even flash on screen -- checked (not
	// just the eventual URL) gates its rendering.
	await expect(page.locator('#login-email')).not.toBeVisible();
});
