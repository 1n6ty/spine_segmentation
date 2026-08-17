import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/core/network/client', () => ({ get: vi.fn().mockResolvedValue({ ok: false }) }));

import { HistoryController } from './history.svelte';
import { SessionService } from '$lib/core/session/session.svelte';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

function square(id: string): Polygon {
	return {
		uuid: id,
		id,
		points: [
			{ x: 0, y: 0 },
			{ x: 0, y: 1 },
			{ x: 1, y: 1 },
			{ x: 1, y: 0 }
		]
	};
}

let session: SessionService;
let history: HistoryController;

beforeEach(async () => {
	session = new SessionService(null);
	await session.loadingPromise;
	history = new HistoryController('side', session);
});

describe('HistoryController.push/undo/redo', () => {
	it('canUndo/canRedo start false', () => {
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
	});

	it('push() snapshots the current polygons and enables undo', () => {
		session.projections.side.polygons = [square('C2')];
		history.push();

		expect(history.canUndo).toBe(true);
		expect(history.past).toHaveLength(1);
		expect(history.past[0]).toEqual([square('C2')]);
	});

	it('push() clears the redo stack', () => {
		session.projections.side.polygons = [square('C2')];
		history.push();
		session.projections.side.polygons = [square('C3')];
		history.push();
		history.undo();
		expect(history.canRedo).toBe(true);

		session.projections.side.polygons = [square('C4')];
		history.push();

		expect(history.canRedo).toBe(false);
		expect(history.future).toHaveLength(0);
	});

	it('undo() restores the previous snapshot and pushes the current one to future', () => {
		session.projections.side.polygons = [square('C2')];
		history.push();
		session.projections.side.polygons = [square('C3')];

		history.undo();

		expect(session.projections.side.polygons).toEqual([square('C2')]);
		expect(history.canRedo).toBe(true);
	});

	it('undo() is a no-op with an empty past', () => {
		session.projections.side.polygons = [square('C2')];
		history.undo();
		expect(session.projections.side.polygons).toEqual([square('C2')]);
	});

	it('redo() re-applies the undone snapshot', () => {
		session.projections.side.polygons = [square('C2')];
		history.push();
		session.projections.side.polygons = [square('C3')];
		history.undo();

		history.redo();

		expect(session.projections.side.polygons).toEqual([square('C3')]);
		expect(history.canUndo).toBe(true);
	});

	it('redo() is a no-op with an empty future', () => {
		session.projections.side.polygons = [square('C2')];
		history.redo();
		expect(session.projections.side.polygons).toEqual([square('C2')]);
	});

	it('caps past at PUBLIC_HISTORY_LIMIT, dropping the oldest snapshots first', async () => {
		const { PUBLIC_HISTORY_LIMIT } = await import('$env/static/public');
		const limit = parseInt(PUBLIC_HISTORY_LIMIT) || 50;

		for (let i = 0; i < limit + 5; i++) {
			session.projections.side.polygons = [square(`v${i}`)];
			history.push();
		}

		expect(history.past.length).toBe(limit);
		expect(history.past[0][0].id).toBe('v5');
	});

	it('clear() empties both stacks', () => {
		session.projections.side.polygons = [square('C2')];
		history.push();

		history.clear();

		expect(history.past).toEqual([]);
		expect(history.future).toEqual([]);
		expect(history.canUndo).toBe(false);
	});
});
