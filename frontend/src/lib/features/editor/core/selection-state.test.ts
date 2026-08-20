import { describe, it, expect } from 'vitest';
import { SelectionState } from './selection-state.svelte';

// A bare {uuid} fixture, deliberately not `Polygon` -- demonstrates the class carries no
// knowledge of the domain shape it's instantiated with.
type Item = { uuid: string };

function item(uuid: string): Item {
	return { uuid };
}

describe('SelectionState.selectOnly', () => {
	it('replaces the selection with just this item and sets the anchor', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('a');
		s.selectOnly('b');

		expect(s.has('a')).toBe(false);
		expect(s.has('b')).toBe(true);
		expect(s.anchor).toBe('b');
		expect(s.size).toBe(1);
	});
});

describe('SelectionState.toggle', () => {
	it('adds an unselected item without moving the anchor', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('a');
		s.toggle('b');

		expect(s.has('a')).toBe(true);
		expect(s.has('b')).toBe(true);
		expect(s.anchor).toBe('a');
	});

	it('removes an already-selected item without moving the anchor', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('a');
		s.toggle('b');
		s.toggle('b');

		expect(s.has('b')).toBe(false);
		expect(s.anchor).toBe('a');
	});
});

describe('SelectionState.selectRange', () => {
	const order = ['a', 'b', 'c', 'd', 'e'];

	it('selects the inclusive range between the anchor and the target, forward', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('b');
		s.selectRange(order, 'd');

		expect([...s.selected].sort()).toEqual(['b', 'c', 'd']);
	});

	it('selects the inclusive range between the anchor and the target, backward', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('d');
		s.selectRange(order, 'b');

		expect([...s.selected].sort()).toEqual(['b', 'c', 'd']);
	});

	it('does not move the anchor', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('b');
		s.selectRange(order, 'd');

		expect(s.anchor).toBe('b');
	});

	it('repeated range-selects measure from the same fixed anchor, not the last endpoint', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('b');
		s.selectRange(order, 'd');
		s.selectRange(order, 'a');

		expect([...s.selected].sort()).toEqual(['a', 'b']);
	});

	it('falls back to selectOnly when there is no anchor', () => {
		const s = new SelectionState<Item>();
		s.selectRange(order, 'c');

		expect([...s.selected]).toEqual(['c']);
		expect(s.anchor).toBe('c');
	});

	it('falls back to selectOnly when the anchor is no longer present in the ordered list', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('stale-uuid');
		s.selectRange(order, 'c');

		expect([...s.selected]).toEqual(['c']);
	});
});

describe('SelectionState.replaceWith / addAll', () => {
	it('replaceWith replaces the whole selection', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('a');
		s.replaceWith(['b', 'c']);

		expect([...s.selected].sort()).toEqual(['b', 'c']);
	});

	it('addAll unions into the current selection', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('a');
		s.addAll(['b', 'c']);

		expect([...s.selected].sort()).toEqual(['a', 'b', 'c']);
	});
});

describe('SelectionState.clear', () => {
	it('empties the selection and resets the anchor', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('a');
		s.clear();

		expect(s.isEmpty).toBe(true);
		expect(s.anchor).toBeNull();
	});
});

describe('SelectionState.has / isSelected / size / isEmpty', () => {
	it('reflects membership by uuid and by entity', () => {
		const s = new SelectionState<Item>();
		s.selectOnly('a');

		expect(s.has('a')).toBe(true);
		expect(s.isSelected(item('a'))).toBe(true);
		expect(s.isSelected(item('b'))).toBe(false);
		expect(s.size).toBe(1);
		expect(s.isEmpty).toBe(false);
	});
});
