import { test, expect } from '@playwright/test';
import { assertBackendReachable, login, uploadSideDicom, DOCTOR, DOCTOR2 } from './helpers';

// Proves the actual security boundary this feature depends on -- every
// UserRecentStudies endpoint scopes to owner=request.user -- at the real
// HTTP/cookie-auth layer, not just via the backend's own unit tests. Two
// separate browser contexts, i.e. two separate cookie jars, so this can't
// pass by accident from shared client-side state.

test.beforeAll(async ({ request }) => {
	await assertBackendReachable(request);
});

test("a second user's recent-studies list never shows another user's session", async ({ browser }) => {
	const contextA = await browser.newContext({ ignoreHTTPSErrors: true });
	const pageA = await contextA.newPage();
	await login(pageA, DOCTOR);
	await uploadSideDicom(pageA);
	await contextA.close();

	const contextB = await browser.newContext({ ignoreHTTPSErrors: true });
	const pageB = await contextB.newPage();
	await login(pageB, DOCTOR2);
	await pageB.goto('/en', { waitUntil: 'networkidle' });

	// Exact "LATERAL /" (not a substring match) -- the app also has static UI
	// copy containing "Lateral" (the upload button/label) that's present
	// regardless of session state and would make a loose match a false
	// positive either way. DOCTOR2 is a freshly seeded account with no
	// uploads of its own -- if this exact badge text appeared, it could only
	// be user A's session leaking across accounts.
	await expect(pageB.getByText('LATERAL /', { exact: true })).not.toBeVisible();
	await contextB.close();
});
