import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Exercises the real workflow end to end against the live docker-compose dev
// stack (./manage.sh up) — load a DICOM, click the autofill ("magic") button,
// confirm the resulting geometric parameters and text diagnostics actually
// render. No mocks: this hits Django, Celery, the real YOLO model weights,
// MySQL, Redis and MinIO through nginx/Traefik.
//
// Fixture choice: Data/spine-segmentation/dicom/side/2.dcm is one of several
// fixtures verified (by hand, via direct API calls) to make the YOLO model
// detect all 24 vertebrae (S1-C2) on the lateral/side projection — required
// for the report page's diagnosis engine to produce real findings instead of
// "insufficient annotation". Other fixtures in this set, and every frontal
// fixture tried, only got partial detections (model/data limitation, not an
// app bug) — so this test deliberately exercises the side projection only.
const SIDE_FIXTURE = path.join(
	__dirname,
	'../../../Data/spine-segmentation/dicom/side/2.dcm'
);

test.beforeAll(async ({ request }) => {
	const res = await request.get('https://localhost/api/health/').catch(() => null);
	if (!res || !res.ok()) {
		throw new Error(
			'Backend stack is not reachable at https://localhost/api/health/ — run `./manage.sh up` first.'
		);
	}
});

test('load DICOM, autofill, view geometric parameters and text diagnostics', async ({ page }) => {
	// --- Login --- the (authenticated) routes require a session, even though
	// the autofill API endpoints themselves don't enforce auth.
	await page.goto('/en-US/login', { waitUntil: 'networkidle' });
	await page.locator('#login-username').fill('admin');
	await page.locator('#login-password').fill('admin');
	await Promise.all([
		page.waitForResponse((r) => r.url().includes('/api/login')),
		page.locator('button[type="submit"]').click()
	]);
	await page.waitForURL(/\/en-US\/?$/);

	// --- Load DICOM (client-side only, no backend call) ---
	await page.getByRole('button', { name: /Upload DICOM file of Lateral projection/i }).click();
	await page.locator('input[type="file"]').setInputFiles(SIDE_FIXTURE);
	await page.waitForURL(/\/patient$/);

	// --- Autofill ("magic" button) ---
	await page.getByText('X-Ray Editing', { exact: false }).click();
	await page.waitForURL(/\/edit$/);

	await page.getByRole('button', { name: 'Autofill' }).click();
	// Re-running against the same fixture hits the DSL cache-check and
	// resolves near-instantly; a fresh run drives real CPU YOLO inference,
	// which has taken up to ~110s in manual verification — the loader
	// disappearing is the real "done" signal, not a fixed sleep.
	await page.locator('img[alt="loader"]').waitFor({ state: 'detached', timeout: 150_000 });
	await expect(page.getByText(/error/i)).not.toBeVisible();

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
