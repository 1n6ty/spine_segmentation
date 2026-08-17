import { test, expect } from '@playwright/test';
import { assertBackendReachable, login, uploadSideDicom, waitForAutofillDone, DOCTOR } from './helpers';

// Exercises the real workflow end to end against the live docker-compose dev
// stack (./manage.sh up) — load a DICOM, load the AI's autofill points,
// confirm the resulting geometric parameters and text diagnostics actually
// render. No mocks: this hits Django, Celery, the real YOLO model weights,
// MySQL, Redis and MinIO through nginx/Traefik.

test.beforeAll(async ({ request }) => {
	await assertBackendReachable(request);
});

test('load DICOM, autofill, view geometric parameters and text diagnostics', async ({ page }) => {
	// --- Login --- the (authenticated) routes require a session; so does
	// /api/dcm/{id}/segment/events/ (the autofill status watch), which 401s
	// without one -- /api/dcm/parse/ itself still doesn't enforce auth.
	await login(page, DOCTOR);

	// --- Load DICOM --- every upload now persists to the backend
	// automatically (creates/attaches a UserRecentStudies row, parses the
	// file server-side, and kicks off AI segmentation) -- there's no more
	// client-side-only path.
	await uploadSideDicom(page);

	// --- Autofill ("magic" button) --- segmentation already started at
	// upload time; this only watches status and, once done, explicitly loads
	// the AI's points.
	await page.getByText('X-Ray Editing', { exact: false }).click();
	await page.waitForURL(/\/edit$/);
	await waitForAutofillDone(page);

	// --- Geometric parameters ---
	await page.getByText('Measurements', { exact: false }).click();
	await page.waitForURL(/\/measure$/);
	const rows = page.locator('table tbody tr');
	await expect(rows.first()).toBeVisible();
	await expect(rows.first()).toContainText(/\d/);

	// --- Text diagnostics ---
	await page.getByText('Diagnostic report', { exact: false }).click();
	await page.waitForURL(/\/report$/);
	// The "insufficient annotation" placeholder (shown when fewer than 24
	// vertebrae are present) must NOT appear for this fixture.
	await expect(page.getByAltText('bone icon')).not.toBeVisible();
	const conclusion = page.locator('#conclusion');
	await expect(conclusion).toBeVisible();
	await expect(conclusion).not.toBeEmpty();
});
