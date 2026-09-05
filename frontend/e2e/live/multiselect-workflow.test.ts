import { test, expect } from '@playwright/test';
import { assertBackendReachable, login, uploadSideDicom, waitForAutofillDone, DOCTOR } from './helpers';

// Exercises the multi-vertebra selection & bulk-action tools (box-select,
// click-to-select, Delete Selected, keyboard Delete, Pan tool, Draw tool)
// against the real docker-compose dev stack -- no mocks.

// The default 1280x720 viewport leaves the editor canvas only partially on
// screen (it renders well past y=720 below the page's own header/toolbar) --
// coordinates below the visible viewport aren't real screen pixels, so
// page.mouse.click() at an off-viewport point silently dispatches nothing
// (confirmed via document.elementFromPoint returning null there), while a
// captured drag (page.mouse.down/move/up, as box-select uses) still reaches
// its target since pointer capture routes events to the capturing element
// regardless of cursor position. A taller viewport fits the whole canvas on
// screen so plain clicks -- the draw-tool section below -- land correctly.
test.use({ viewport: { width: 1280, height: 1400 } });

test.beforeAll(async ({ request }) => {
	await assertBackendReachable(request);
});

test('multi-vertebra selection & bulk actions', async ({ page }) => {
	await login(page, DOCTOR);
	await uploadSideDicom(page);

	await page.getByText('X-Ray Editing', { exact: false }).click();
	await page.waitForURL(/\/edit$/);
	await waitForAutofillDone(page);

	// Select/Pan tool buttons are present.
	const selectBtn = page.getByTitle('Select tool');
	const panBtn = page.getByTitle('Pan tool');
	await expect(selectBtn).toBeVisible();
	await expect(panBtn).toBeVisible();

	// The editor's own toolbar (Select tool's parent container) no longer has
	// a Clear All button. Scoped to that toolbar specifically -- the
	// sessions manager sidebar (rendered in the shared authenticated layout,
	// present on every page) has its own unrelated "Clear all" (delete all
	// research sessions) button with the same visible text.
	const toolbar = selectBtn.locator('xpath=..');
	await expect(toolbar.getByText('Clear all', { exact: false })).toHaveCount(0);

	// Delete Selected is disabled until something is selected.
	const deleteSelectedBtn = page.getByRole('button', { name: 'Delete selected' });
	await expect(deleteSelectedBtn).toBeVisible();
	await expect(deleteSelectedBtn).toBeDisabled();

	const canvas = page.locator('canvas').first();

	// Re-fetched on every use rather than cached once -- across a long
	// interaction sequence like this one the canvas can genuinely reflow
	// (e.g. a scrollbar appearing/disappearing), and a stale bounding box
	// silently sends later clicks a few pixels off target.
	async function canvasBox() {
		const box = await canvas.boundingBox();
		if (!box) throw new Error('canvas not found');
		return box;
	}

	async function dragBoxOverWholeCanvas() {
		const box = await canvasBox();
		await page.mouse.move(box.x + 5, box.y + 5);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width - 5, box.y + box.height - 5, { steps: 5 });
		await page.mouse.up();
	}

	// --- Box-select the whole canvas: selects every autofilled vertebra ---
	await dragBoxOverWholeCanvas();
	await expect(deleteSelectedBtn).toBeEnabled();

	// --- Clicking empty space clears the selection ---
	{
		const box = await canvasBox();
		await page.mouse.click(box.x + box.width - 5, box.y + 5);
	}
	await expect(deleteSelectedBtn).toBeDisabled();

	// --- Bulk delete via the panel button, then Undo restores everything ---
	// (Undo isn't asserted disabled beforehand -- autofill's own apply step
	// already pushes one history entry, so it's enabled from the start.)
	await dragBoxOverWholeCanvas();
	await expect(deleteSelectedBtn).toBeEnabled();

	const undoBtn = page.getByTitle('Back');

	await deleteSelectedBtn.click();
	await expect(deleteSelectedBtn).toBeDisabled();
	await expect(undoBtn).toBeEnabled();

	await undoBtn.click();
	await dragBoxOverWholeCanvas();
	await expect(deleteSelectedBtn).toBeEnabled();

	// --- The Delete key deletes the selection too ---
	await page.keyboard.press('Delete');
	await expect(deleteSelectedBtn).toBeDisabled();
	await expect(undoBtn).toBeEnabled();
	// Deliberately NOT undone here (Undo restoring a deletion is already covered by the
	// mouse-delete case above) -- the canvas is left empty on purpose, since the draw-tool
	// step below needs room under EditorCanvas.svelte's MAX_VERTEBRAE=24 cap. Autofill
	// against a fully-detected fixture (see SIDE_FIXTURE) fills all 24 slots, so undoing
	// this delete back to a full spine would leave nothing to add.

	// --- Pan tool: switching to it and dragging pans the view without error ---
	await panBtn.click();
	{
		const box = await canvasBox();
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 30, { steps: 5 });
		await page.mouse.up();
	}
	await selectBtn.click();

	// --- Draw tool: a freshly-drawn vertebra is auto-selected ---
	await page.getByTitle('Add').click();
	{
		const box = await canvasBox();
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		await page.mouse.click(cx - 60, cy - 60);
		await page.mouse.click(cx - 60, cy + 60);
		await page.mouse.click(cx + 60, cy + 60);
		await page.mouse.click(cx + 60, cy - 60);
	}
	await expect(deleteSelectedBtn).toBeEnabled();
});
