import { test, expect } from '@playwright/test';
import { assertBackendReachable, login, uploadSideDicom, DOCTOR } from './helpers';

// Proves the actual headline feature this branch ships: a session is no
// longer only-in-the-browser. None of this had e2e coverage before.

test.beforeAll(async ({ request }) => {
	await assertBackendReachable(request);
});

test('an uploaded session appears in "recent studies" live, without a reload, and survives one', async ({
	page
}) => {
	await login(page, DOCTOR);
	await uploadSideDicom(page);

	// The "Recent studies" list (Manager.svelte) is rendered on every
	// authenticated page, including /patient -- so the just-uploaded card
	// must appear right here, on the same page, with no navigation or reload
	// at all. This is the specific regression to guard: requestSave()'s
	// debounced backend PATCHes used to leave registry.sessionValues stale
	// until a full page reload, so this card would only have shown up after
	// one.
	//
	// Exact "LATERAL /" (not a substring match) -- the app also has static UI
	// copy containing "Lateral" (the upload button/label) that's present
	// regardless of session state and would make a loose match meaningless.
	// .first() because other specs in this run share the same seeded account,
	// so more than one "recent study" may legitimately already exist.
	await expect(page.getByText('LATERAL /', { exact: true }).first()).toBeVisible({
		timeout: 15_000
	});

	// The thumbnail must actually be a real image, not the empty/missing
	// state (which renders as a plain dark placeholder box, since requestSave()
	// used to read the DICOM bitmap synchronously before it had finished
	// decoding and silently skipped saving a thumbnail on the very first save).
	await expect(page.getByAltText('Preview').first()).toHaveAttribute(
		'src',
		/^data:image\//,
		{ timeout: 15_000 }
	);

	// Reload while still on /researches/{id}/patient -- the URL itself names
	// the research (researches/[research_id]/+layout.svelte re-fetches
	// exactly that id from the backend on mount). There is no local
	// DICOM/polygon cache to fall back on anymore (IndexedDB/Cache Storage
	// were removed), so this only passes if the backend round trip actually
	// works.
	await page.reload({ waitUntil: 'networkidle' });
	await expect(page.getByText('LATERAL /', { exact: true }).first()).toBeVisible();

	// Back on the landing page, the session shows up in "Recent studies".
	await page.goto('/en', { waitUntil: 'networkidle' });
	await expect(page.getByText('LATERAL /', { exact: true }).first()).toBeVisible();
});

test('tracks the active research in the URL, and "New research" does not navigate away from it', async ({
	page
}) => {
	await login(page, DOCTOR);
	await uploadSideDicom(page);

	// The just-created research's own id is now part of the URL, not just
	// the tab name -- what makes it bookmarkable/shareable and trackable in
	// browser history, rather than every research looking identical.
	await expect(page).toHaveURL(/\/researches\/\d+\/patient$/);

	// Switching tabs preserves the same research id in the URL.
	await page.getByText('X-Ray Editing', { exact: false }).click();
	await expect(page).toHaveURL(/\/researches\/\d+\/edit$/);
	const editUrl = page.url();

	// "New research" resets the session (Manager.svelte) but must not
	// navigate anywhere -- the URL stays exactly where it was.
	await page.getByRole('button', { name: 'New research' }).click();
	expect(page.url()).toBe(editUrl);
});

test('navigating back to the landing page from a research deselects it', async ({ page }) => {
	await login(page, DOCTOR);
	await uploadSideDicom(page);

	await expect(page).toHaveURL(/\/researches\/\d+\/patient$/);

	// Client-side (SPA) back-navigation -- not page.goto()/reload, which would
	// trigger the unrelated "resume whichever research I last touched on a
	// cold load" path instead of exercising in-app navigation.
	await page.goBack();
	await expect(page).toHaveURL(/\/en\/?$/);

	// DicomUploadCard must show the empty upload prompt again, not the
	// "accepted" state carried over from the research just left.
	await expect(
		page.getByRole('button', { name: /Upload DICOM file of Lateral projection/i })
	).toBeVisible();

	// No recent-studies card should render as "active" anymore -- confirmed
	// via "New research", which Manager.svelte disables exactly when
	// project.session.sessionUID is already empty.
	await expect(page.getByRole('button', { name: 'New research' })).toBeDisabled();
});

test('a hard navigation to the landing page also deselects the active research', async ({
	page
}) => {
	await login(page, DOCTOR);
	await uploadSideDicom(page);

	await expect(page).toHaveURL(/\/researches\/\d+\/patient$/);

	// page.goto(), not a link click or history navigation -- a full browser
	// navigation, same as typing the URL or hitting reload. There is
	// deliberately no "resume whichever research I last touched" exception
	// for this case: the landing page must be empty regardless of how you
	// got there.
	await page.goto('/en', { waitUntil: 'networkidle' });
	await expect(page).toHaveURL(/\/en\/?$/);

	await expect(
		page.getByRole('button', { name: /Upload DICOM file of Lateral projection/i })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'New research' })).toBeDisabled();
});

test('clicking a recent-studies card reopens that session', async ({ page }) => {
	await login(page, DOCTOR);
	await uploadSideDicom(page);

	await page.goto('/en', { waitUntil: 'networkidle' });

	// The landing page always starts deselected (no "resume last touched"
	// behavior) -- the just-uploaded session's card is already inactive/
	// clickable here, no "New research" pre-step needed to get there.
	const card = page.getByText('LATERAL /', { exact: true }).first();
	await expect(card).toBeVisible();
	await card.click();

	await page.waitForURL(/\/patient$/);
	await expect(page.getByText('LATERAL /', { exact: true }).first()).toBeVisible();
});
