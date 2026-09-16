import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { getInstanceContainer } from './instance-container.svelte';
import { SessionService } from '$lib/core/session/session.svelte';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

function square(id: string, cx: number, cy: number): Polygon {
	const h = 10;
	return {
		uuid: id,
		id,
		points: [
			{ x: cx - h, y: cy + h },
			{ x: cx - h, y: cy - h },
			{ x: cx + h, y: cy - h },
			{ x: cx + h, y: cy + h }
		]
	};
}

/**
 * Regression coverage for getInstanceContainer()'s persistence (EditorCanvas.svelte reuses the
 * same InstanceContainer across a tab-switch remount instead of constructing a fresh one --
 * see instance-container.svelte.ts). A tab switch is simulated here by simply calling
 * getInstanceContainer() again for the same session+projection, mirroring exactly what
 * EditorCanvas.svelte's `$derived` does on every (re)mount.
 */
describe('history + central line stay in sync across a simulated tab-switch remount', () => {
	it('undo after a remount still enables redo and drops the added vertebra from both polygons and the central line', async () => {
		const session = new SessionService(null);
		await session.loadingPromise;

		session.projections.side.polygons = [square('L5', 100, 100)];

		// "mount" the edit tab -- first EditorCanvas mount
		const beforeSwitch = getInstanceContainer(session, 'side');

		// simulate DrawTool.commit()'s add-vertebra sequence: push history, then append
		beforeSwitch.tools.history.push();
		session.projections.side.polygons = [
			...session.projections.side.polygons,
			square('S1', 100, 140)
		];
		expect(beforeSwitch.centralLine.centralPath?.controlPoints).toHaveLength(4);

		// simulate navigating away (unmount) and back (remount) -- a second EditorCanvas mount
		// for the SAME session+projection
		const afterSwitch = getInstanceContainer(session, 'side');
		expect(afterSwitch).toBe(beforeSwitch); // same cached InstanceContainer, not a fresh one

		expect(afterSwitch.tools.history.canUndo).toBe(true);
		expect(afterSwitch.tools.history.canRedo).toBe(false);

		afterSwitch.tools.history.undo();

		expect(session.projections.side.polygons.map((p) => p.id)).toEqual(['L5']);
		expect(afterSwitch.tools.history.canRedo).toBe(true);
		// The central line is purely derived from `polygons` -- with S1 undone, only L5's own
		// two plate midpoints remain as control points.
		expect(afterSwitch.centralLine.centralPath?.controlPoints).toHaveLength(2);
		expect(
			afterSwitch.centralLine.centralPath?.controlPoints.every((cp) => cp.vertebraIndex === 0)
		).toBe(true);

		afterSwitch.tools.history.redo();

		expect(session.projections.side.polygons.map((p) => p.id)).toEqual(['L5', 'S1']);
		expect(afterSwitch.tools.history.canRedo).toBe(false);
		expect(afterSwitch.centralLine.centralPath?.controlPoints).toHaveLength(4);
	});

	/** Matches the exact reported scenario: 3 vertebrae already present, then a 4th added,
	 * multiple simulated tab switches, and undo invoked the same way a toolbar Button does --
	 * `callback={projectionContainer.tools.history.undo}`, i.e. a DETACHED reference to the
	 * method, called later, not `container.tools.history.undo()` inline. */
	it('holds up with 3+ pre-existing vertebrae, multiple tab switches, and a detached undo callback', async () => {
		const session = new SessionService(null);
		await session.loadingPromise;

		session.projections.side.polygons = [
			square('S1', 100, 400),
			square('L5', 100, 300),
			square('L4', 100, 200)
		];

		const c1 = getInstanceContainer(session, 'side');
		c1.tools.history.push();
		session.projections.side.polygons = [
			...session.projections.side.polygons,
			square('L3', 100, 100)
		];
		expect(c1.centralLine.centralPath?.controlPoints).toHaveLength(8);

		// simulate switching tabs away and back, several times over
		let container = c1;
		for (let i = 0; i < 3; i++) {
			container = getInstanceContainer(session, 'side');
		}
		expect(container).toBe(c1);

		// mirrors `<Button callback={projectionContainer.tools.history.undo} />` -- the method is
		// read out and stored as a value, then invoked later on click, not called inline.
		const undoCallback = container.tools.history.undo;
		undoCallback();

		expect(session.projections.side.polygons.map((p) => p.id)).toEqual(['S1', 'L5', 'L4']);
		expect(container.tools.history.canRedo).toBe(true);
		expect(container.centralLine.centralPath?.controlPoints).toHaveLength(6);
		expect(container.centralLine.centralPath?.controlPoints.map((cp) => cp.vertebraIndex)).toEqual([
			0, 0, 1, 1, 2, 2
		]);
	});
});
