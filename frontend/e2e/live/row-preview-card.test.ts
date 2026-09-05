import { test, expect } from '@playwright/test';
import {
	assertBackendReachable,
	login,
	uploadSideDicom,
	waitForAutofillDone,
	DOCTOR
} from './helpers';

// Module 4: hovering a Measurement Table row pops up a calibrated crop preview of that row's
// anatomical region (its own canvas, drawn straight from the DICOM bitmap -- /measure never
// mounts the editor) with a grid overlay and a live "X mm / sq" legend. Exercised against the
// real docker-compose dev stack so the preview draws from a real annotated bitmap, not a mock.

test.beforeAll(async ({ request }) => {
	await assertBackendReachable(request);
});

test('hovering a measurement row shows a calibrated crop preview, mouseleave hides it', async ({
	page
}) => {
	await login(page, DOCTOR);
	await uploadSideDicom(page);

	await page.getByText('X-Ray Editing', { exact: false }).click();
	await page.waitForURL(/\/edit$/);
	await waitForAutofillDone(page);

	await page.getByText('Measurements', { exact: false }).click();
	await page.waitForURL(/\/measure$/);

	const firstRow = page.locator('table tbody tr').first();
	await expect(firstRow).toBeVisible();

	// No preview until a row is actually hovered.
	await expect(page.locator('canvas')).toHaveCount(0);

	// Raw CDP-level mouse moves (not locator.hover()) for both the enter and leave step
	// below -- element-targeted `.hover()` re-triggers scrollIntoViewIfNeeded/actionability
	// checks that can scroll the row to a different position than where its bounding box
	// was read, making a follow-up "move away" coordinate land somewhere unpredictable.
	// Reading the box once, right after an explicit scroll, keeps both moves anchored to
	// the same, already-settled layout.
	await firstRow.scrollIntoViewIfNeeded();
	const rowBox = await firstRow.boundingBox();
	if (!rowBox) throw new Error('row has no bounding box');
	await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);

	// The preview card renders its own canvas (the only one on this route -- the
	// editor canvas isn't mounted here) and a "X.X mm / sq" scale legend.
	const canvas = page.locator('canvas');
	await expect(canvas).toBeVisible();
	const box = await canvas.boundingBox();
	expect(box?.width).toBeGreaterThan(0);
	expect(box?.height).toBeGreaterThan(0);

	await expect(page.getByText(/^\d+(\.\d+)? mm \/ sq$/)).toBeVisible();

	// Moving off the row hides the preview again -- target the structure-tab bar (well
	// above either table entirely, not just N pixels above this row) so the new point
	// can't land on a neighboring tbody row and keep the preview showing for a different
	// row instead of none.
	const tabsBox = await page.getByRole('button', { name: 'Vertebrae', exact: true }).boundingBox();
	if (!tabsBox) throw new Error('structure tabs have no bounding box');
	await page.mouse.move(tabsBox.x + tabsBox.width / 2, tabsBox.y + tabsBox.height / 2);
	await expect(page.locator('canvas')).toHaveCount(0);
});
