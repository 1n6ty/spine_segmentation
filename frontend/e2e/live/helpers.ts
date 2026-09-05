import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `./manage.sh test-e2e` seeds the stack via `manage.py seed_dev_data
// --manifest-path=...` and sets SEED_MANIFEST_PATH to where it copied the
// resulting JSON — read real credentials from there rather than hardcoding
// values that could drift from what that command actually seeds. Falls back
// to the same defaults `seed_dev_data` uses when run without a manifest, for
// a developer running this suite locally against an already-seeded stack.
const MANIFEST_PATH = process.env.SEED_MANIFEST_PATH;
const manifest =
	MANIFEST_PATH && existsSync(MANIFEST_PATH)
		? JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
		: null;

export const DOCTOR = {
	email: manifest?.doctor?.email ?? 'doctor@example.com',
	password: manifest?.doctor?.password ?? 'Bx4-Radius-DoctorSeed-19'
};

// Second seeded account -- only used by specs proving cross-user isolation of
// recent studies (UserRecentStudies.owner scoping). See seed_dev_data.py.
export const DOCTOR2 = {
	email: manifest?.doctor2?.email ?? 'doctor2@example.com',
	password: manifest?.doctor2?.password ?? 'Qz8-Vector-DoctorSeed-42'
};

// Verified (by hand, via a direct model probe against the built api-celery
// image) to make the YOLO model detect exactly the 24 real vertebrae (S1-C2)
// on the lateral/side projection, with zero spurious extra detections --
// required for the report page's diagnosis engine to produce real findings
// instead of "insufficient annotation" (needs all 24), and for
// multiselect-workflow.test.ts's draw-tool step (needs to stay under
// EditorCanvas.svelte's MAX_VERTEBRAE=24 cap after undoing a delete, which a
// noisier fixture blows past). The previously-used 2.dcm also detects all 24
// real vertebrae, but the segmentation heal/reveal pipeline additionally
// fabricates ~17 extra unnamed polygons for it specifically (41 total) --
// harmless for specs that only care about the named 24, but it permanently
// pins polygons.length above the cap for any spec that expects room to draw
// one more. Other fixtures in this set, and every frontal fixture tried,
// only got partial detections (model/data limitation, not an app bug) -- so
// specs needing a full detection deliberately use this one.
export const SIDE_FIXTURE = path.join(__dirname, '../../../Data/spine-segmentation/dicom/side/0.dcm');

export async function assertBackendReachable(request: {
	get: (url: string) => Promise<{ ok(): boolean }>;
}) {
	const res = await request.get('/api/health/').catch(() => null);
	if (!res || !res.ok()) {
		throw new Error('Backend stack is not reachable at /api/health/ — run `./manage.sh up` first.');
	}
}

export async function login(page: Page, credentials: { email: string; password: string }) {
	await page.goto('/en/login', { waitUntil: 'networkidle' });
	await page.locator('#login-email').fill(credentials.email);
	await page.locator('#login-password').fill(credentials.password);
	await Promise.all([
		page.waitForResponse((r) => r.url().includes('/api/login')),
		page.locator('button[type="submit"]').click()
	]);
	await page.waitForURL(/\/en\/?$/);
}

/** Uploads the side/lateral fixture. This is now a real backend round trip
 * (parse + attach), not the client-side-only action it used to be -- every
 * upload persists to the backend automatically. */
export async function uploadSideDicom(page: Page, fixture: string = SIDE_FIXTURE) {
	await page.getByRole('button', { name: /Upload DICOM file of Lateral projection/i }).click();
	await page.locator('input[type="file"]').setInputFiles(fixture);
	await page.waitForURL(/\/patient$/);
}

/**
 * Clicks "Autofill" and waits for the (already-running, automatic-on-upload)
 * segmentation pipeline to finish -- the button no longer re-uploads or
 * re-triggers segmentation itself, it only watches current status. Points
 * are applied the instant the result arrives, with no separate confirm/click
 * step (a pre-flight overwrite-confirm card only appears if this projection
 * already has points, which it doesn't on a fresh upload).
 */
export async function waitForAutofillDone(page: Page) {
	const autofillBtn = page.getByRole('button', { name: 'Autofill' });
	await autofillBtn.click();

	// A real click() (mousedown -> mouseup -> click, what Playwright sends) has, empirically,
	// sometimes failed to reach this button's Svelte handler at all in this headless/docker
	// environment -- root cause not fully isolated, but confirmed via direct instrumentation
	// that when it happens, handleMagicClick() never runs. Left unguarded, that's a silent
	// false pass: the loader below would never have attached, and
	// waitFor({state:'detached'}) resolves immediately for an element that was never present,
	// same as one that appeared and disappeared -- so the test would sail through as if
	// autofill had run when nothing ever started.
	//
	// Guard against that here: the button disables itself synchronously the instant its click
	// handler runs (see EditorCanvas.svelte's `disabled={magicStatus !== 'idle' ...}`), before
	// any network round trip -- so it reliably goes disabled fast regardless of how quickly the
	// pipeline itself then resolves (a fresh run drives real CPU YOLO inference and can take up
	// to ~110s; re-running against an already-segmented fixture can resolve near-instantly). If
	// it doesn't disable, the first click didn't register -- dispatch a real 'click' event
	// directly on the DOM node as a fallback, which has reliably worked when locator.click()
	// didn't, and confirm again before trusting anything downstream.
	try {
		await expect(autofillBtn).toBeDisabled({ timeout: 3_000 });
	} catch {
		await page.evaluate(() => {
			const btn = [...document.querySelectorAll('button')].find(
				(b) => b.textContent?.trim() === 'Autofill'
			);
			btn?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		});
		await expect(autofillBtn).toBeDisabled({ timeout: 5_000 });
	}

	// Re-running against the same fixture hits the DB cache-check and resolves
	// near-instantly; a fresh run drives real CPU YOLO inference, which has
	// taken up to ~110s in manual verification -- the loader disappearing is
	// the real "done" signal, not a fixed sleep.
	await page.locator('img[alt="loader"]').waitFor({ state: 'detached', timeout: 150_000 });
	await expect(page.getByText(/error/i)).not.toBeVisible();
}
