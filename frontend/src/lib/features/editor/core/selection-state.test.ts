import { describe, it, expect } from 'vitest';
import {
	PolygonSelectionState,
	pointKeysOf,
	selectionEntryKey,
	type SelectionEntry,
	type Side
} from './selection-state.svelte';

function vertebra(polygonUuid: string): SelectionEntry {
	return { kind: 'vertebra', polygonUuid };
}
function side(polygonUuid: string, side: Side): SelectionEntry {
	return { kind: 'side', polygonUuid, side };
}
function point(polygonUuid: string, pointIndex: number): SelectionEntry {
	return { kind: 'point', polygonUuid, pointIndex };
}

describe('selectionEntryKey', () => {
	it('gives distinct entries of different kinds on the same polygon distinct keys', () => {
		const keys = new Set([
			selectionEntryKey(vertebra('a')),
			selectionEntryKey(side('a', 'left')),
			selectionEntryKey(side('a', 'right')),
			selectionEntryKey(point('a', 0))
		]);
		expect(keys.size).toBe(4);
	});

	it('gives equal entries equal keys', () => {
		expect(selectionEntryKey(point('a', 2))).toBe(selectionEntryKey(point('a', 2)));
	});
});

describe('pointKeysOf', () => {
	it('expands a vertebra entry to all 4 point indices', () => {
		const keys = pointKeysOf([vertebra('a')]);
		expect(keys.map((k) => k.pointIndex).sort()).toEqual([0, 1, 2, 3]);
		expect(keys.every((k) => k.polygonUuid === 'a')).toBe(true);
	});

	it('expands a side entry to its 2 point indices', () => {
		expect(
			pointKeysOf([side('a', 'left')])
				.map((k) => k.pointIndex)
				.sort()
		).toEqual([0, 1]);
		expect(
			pointKeysOf([side('a', 'right')])
				.map((k) => k.pointIndex)
				.sort()
		).toEqual([2, 3]);
	});

	it('expands top/bottom side entries to their 2 point indices', () => {
		expect(
			pointKeysOf([side('a', 'top')])
				.map((k) => k.pointIndex)
				.sort()
		).toEqual([1, 2]);
		expect(
			pointKeysOf([side('a', 'bottom')])
				.map((k) => k.pointIndex)
				.sort()
		).toEqual([0, 3]);
	});

	it('passes a point entry through as-is', () => {
		expect(pointKeysOf([point('a', 3)])).toEqual([{ polygonUuid: 'a', pointIndex: 3 }]);
	});

	it('deduplicates overlapping coverage across entries (e.g. a side and one of its own points)', () => {
		const keys = pointKeysOf([side('a', 'left'), point('a', 0)]);
		expect(keys).toHaveLength(2);
	});

	it('handles a mix across multiple polygons', () => {
		const keys = pointKeysOf([vertebra('a'), point('b', 1)]);
		expect(keys).toHaveLength(5);
		expect(keys.filter((k) => k.polygonUuid === 'a')).toHaveLength(4);
		expect(keys.filter((k) => k.polygonUuid === 'b')).toHaveLength(1);
	});
});

describe('PolygonSelectionState.selectOnly', () => {
	it('replaces the selection with just this entry and sets the anchor', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('a'));
		s.selectOnly(vertebra('b'));

		expect(s.has(vertebra('a'))).toBe(false);
		expect(s.has(vertebra('b'))).toBe(true);
		expect(s.anchor).toEqual(vertebra('b'));
		expect(s.size).toBe(1);
	});
});

describe('PolygonSelectionState.toggleOne', () => {
	it('adds an unselected entry without moving the anchor', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('a'));
		s.toggleOne(side('b', 'left'));

		expect(s.has(vertebra('a'))).toBe(true);
		expect(s.has(side('b', 'left'))).toBe(true);
		expect(s.anchor).toEqual(vertebra('a'));
	});

	it('removes an already-selected entry without moving the anchor', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('a'));
		s.toggleOne(side('b', 'left'));
		s.toggleOne(side('b', 'left'));

		expect(s.has(side('b', 'left'))).toBe(false);
		expect(s.anchor).toEqual(vertebra('a'));
	});

	it('is agnostic of granularity -- a whole vertebra, a side, and a point can coexist', () => {
		const s = new PolygonSelectionState();
		s.toggleOne(vertebra('a'));
		s.toggleOne(side('b', 'right'));
		s.toggleOne(point('c', 2));

		expect(s.size).toBe(3);
		expect(s.has(vertebra('a'))).toBe(true);
		expect(s.has(side('b', 'right'))).toBe(true);
		expect(s.has(point('c', 2))).toBe(true);
	});
});

describe('PolygonSelectionState.isSoleSelection', () => {
	it('is true only when the selection has exactly this one entry', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(point('a', 0));

		expect(s.isSoleSelection(point('a', 0))).toBe(true);
		expect(s.isSoleSelection(point('a', 1))).toBe(false);

		s.toggleOne(point('a', 1));
		expect(s.isSoleSelection(point('a', 0))).toBe(false);
	});

	it('is false on an empty selection', () => {
		const s = new PolygonSelectionState();
		expect(s.isSoleSelection(point('a', 0))).toBe(false);
	});
});

describe('PolygonSelectionState.selectPointRangeByVertebra', () => {
	const order = ['a', 'b', 'c', 'd', 'e'];

	it('flattens the inclusive vertebra range into 4 point entries each, forward', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('b'));
		s.selectPointRangeByVertebra(order, vertebra('d'));

		expect(s.size).toBe(12); // 3 vertebrae x 4 points
		for (const uuid of ['b', 'c', 'd']) {
			for (let i = 0; i < 4; i++) expect(s.has(point(uuid, i))).toBe(true);
		}
		expect(s.has(point('a', 0))).toBe(false);
		expect(s.has(point('e', 0))).toBe(false);
	});

	it('flattens the inclusive range backward the same way', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('d'));
		s.selectPointRangeByVertebra(order, vertebra('b'));

		expect(s.has(point('b', 0))).toBe(true);
		expect(s.has(point('c', 0))).toBe(true);
		expect(s.has(point('d', 0))).toBe(true);
	});

	it('resolves to the target vertebra regardless of the entry granularity clicked', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('b'));
		s.selectPointRangeByVertebra(order, side('d', 'left'));

		expect(s.has(point('d', 0))).toBe(true);
		expect(s.has(point('d', 3))).toBe(true);
	});

	it('does not move the anchor', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('b'));
		s.selectPointRangeByVertebra(order, vertebra('d'));

		expect(s.anchor).toEqual(vertebra('b'));
	});

	it('repeated range-selects measure from the same fixed anchor, not the last endpoint', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('b'));
		s.selectPointRangeByVertebra(order, vertebra('d'));
		s.selectPointRangeByVertebra(order, vertebra('a'));

		expect(s.has(point('a', 0))).toBe(true);
		expect(s.has(point('b', 0))).toBe(true);
		expect(s.has(point('c', 0))).toBe(false);
	});

	it('falls back to selectOnly when there is no anchor', () => {
		const s = new PolygonSelectionState();
		s.selectPointRangeByVertebra(order, vertebra('c'));

		expect(s.all).toEqual([vertebra('c')]);
		expect(s.anchor).toEqual(vertebra('c'));
	});

	it('falls back to selectOnly when the anchor is no longer present in the ordered list', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('stale-uuid'));
		s.selectPointRangeByVertebra(order, vertebra('c'));

		expect(s.all).toEqual([vertebra('c')]);
	});
});

describe('PolygonSelectionState.selectPointRangeOverVertebraSet', () => {
	const order = ['a', 'b', 'c', 'd', 'e'];

	it('spans from the anchor to whichever touched vertebra is farthest in either direction', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('c'));
		s.selectPointRangeOverVertebraSet(order, ['b', 'd'], []);

		expect(s.has(point('b', 0))).toBe(true);
		expect(s.has(point('c', 0))).toBe(true);
		expect(s.has(point('d', 0))).toBe(true);
		expect(s.has(point('a', 0))).toBe(false);
		expect(s.has(point('e', 0))).toBe(false);
	});

	it('falls back to a plain replace with fallbackEntries when there is no anchor', () => {
		const s = new PolygonSelectionState();
		const fallback = [vertebra('b'), vertebra('d')];
		s.selectPointRangeOverVertebraSet(order, ['b', 'd'], fallback);

		expect(s.all.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))).toEqual(
			[...fallback].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
		);
	});
});

describe('PolygonSelectionState.replaceWithMany / toggleMany', () => {
	it('replaceWithMany replaces the whole selection', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('a'));
		s.replaceWithMany([vertebra('b'), side('c', 'left')]);

		expect(s.has(vertebra('a'))).toBe(false);
		expect(s.has(vertebra('b'))).toBe(true);
		expect(s.has(side('c', 'left'))).toBe(true);
		expect(s.size).toBe(2);
	});

	it('toggleMany toggles each entry independently', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('a'));
		s.toggleMany([vertebra('a'), vertebra('b')]);

		expect(s.has(vertebra('a'))).toBe(false); // was selected -> toggled off
		expect(s.has(vertebra('b'))).toBe(true); // wasn't selected -> toggled on
	});
});

describe('PolygonSelectionState.clear', () => {
	it('empties the selection and resets the anchor', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('a'));
		s.clear();

		expect(s.isEmpty).toBe(true);
		expect(s.anchor).toBeNull();
	});
});

describe('PolygonSelectionState.has / size / isEmpty / all', () => {
	it('reflects membership and contents', () => {
		const s = new PolygonSelectionState();
		s.selectOnly(vertebra('a'));

		expect(s.has(vertebra('a'))).toBe(true);
		expect(s.has(vertebra('b'))).toBe(false);
		expect(s.size).toBe(1);
		expect(s.isEmpty).toBe(false);
		expect(s.all).toEqual([vertebra('a')]);
	});
});
