import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Polygon } from '$lib/shared/geometry/geometry.type';
import {
	SegmentRangePicker,
	nearestVertebraByPlate,
	hitTestVertebraBody
} from './segment-range-picker.svelte';

class FakeElement {
	setPointerCapture = vi.fn();
	releasePointerCapture = vi.fn();
}

beforeEach(() => {
	vi.stubGlobal('Element', FakeElement);
});

function fake_pointer_event(overrides: Partial<PointerEvent> = {}) {
	return {
		clientX: 0,
		clientY: 0,
		pointerId: 1,
		button: 0,
		target: new FakeElement(),
		...overrides
	} as unknown as PointerEvent;
}

function square(id: string, cx: number, cy: number, h = 10): Polygon {
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

// Ordered inferior -> superior, matching `orderAndName()`'s guarantee, same as elsewhere in
// this codebase's tests. Index 0 = S1 (most inferior), index 3 = L3 (most superior here).
function four_vertebrae(): Polygon[] {
	return [
		square('S1', 100, 200),
		square('L5', 100, 150),
		square('L4', 100, 100),
		square('L3', 100, 50)
	];
}

describe('nearestVertebraByPlate', () => {
	it('finds the nearest vertebra by its top-plate midpoint for the superior role', () => {
		const polys = four_vertebrae();
		// L4's top plate is (100, 90) -- closest to (100, 92).
		expect(nearestVertebraByPlate(polys, 'superior', { x: 100, y: 92 })).toBe(2);
	});

	it('finds the nearest vertebra by its bottom-plate midpoint for the inferior role', () => {
		const polys = four_vertebrae();
		// L5's bottom plate is (100, 160) -- closest to (100, 158).
		expect(nearestVertebraByPlate(polys, 'inferior', { x: 100, y: 158 })).toBe(1);
	});
});

describe('hitTestVertebraBody', () => {
	it('returns the index of the polygon containing the point', () => {
		const polys = four_vertebrae();
		expect(hitTestVertebraBody(polys, { x: 100, y: 150 })).toBe(1);
	});

	it('returns null outside every polygon', () => {
		const polys = four_vertebrae();
		expect(hitTestVertebraBody(polys, { x: 1000, y: 1000 })).toBeNull();
	});
});

describe('SegmentRangePicker.centralPath', () => {
	it('is non-null even for a single vertebra (its own bottom/top plate form a trivial line)', () => {
		const picker = new SegmentRangePicker(() => [square('S1', 100, 100)]);
		expect(picker.centralPath).not.toBeNull();
	});

	it('is derived from the current polygons', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		expect(picker.centralPath).not.toBeNull();
	});
});

describe('SegmentRangePicker default selection', () => {
	it('defaults to the full spine selected when polygons are present', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		expect(picker.inferiorIndex).toBe(0);
		expect(picker.superiorIndex).toBe(3);
		expect(picker.range).toEqual({ topId: 'L3', bottomId: 'S1' });
	});

	it('has no default selection when there are no polygons', () => {
		const picker = new SegmentRangePicker(() => []);
		expect(picker.superiorIndex).toBeNull();
		expect(picker.inferiorIndex).toBeNull();
		expect(picker.hasSelection).toBe(false);
	});
});

describe('SegmentRangePicker.selectVertebra', () => {
	it('a plain click selects a single vertebra and sets the anchor', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(1, false);
		expect(picker.superiorIndex).toBe(1);
		expect(picker.inferiorIndex).toBe(1);
		expect(picker.range).toEqual({ topId: 'L5', bottomId: 'L5' });
	});

	it('shift+click after an anchor selects the contiguous range, clicking downward', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(1, false); // anchor = L5 (index 1)
		picker.selectVertebra(3, true); // shift+click L3 (index 3)
		expect(picker.inferiorIndex).toBe(1);
		expect(picker.superiorIndex).toBe(3);
		expect(picker.range).toEqual({ topId: 'L3', bottomId: 'L5' });
	});

	it('shift+click after an anchor selects the contiguous range, clicking upward', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(3, false); // anchor = L3 (index 3)
		picker.selectVertebra(1, true); // shift+click L5 (index 1)
		expect(picker.inferiorIndex).toBe(1);
		expect(picker.superiorIndex).toBe(3);
		expect(picker.range).toEqual({ topId: 'L3', bottomId: 'L5' });
	});

	it('shift+click with no prior anchor behaves like a plain click', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(2, true);
		expect(picker.superiorIndex).toBe(2);
		expect(picker.inferiorIndex).toBe(2);
	});
});

describe('SegmentRangePicker.range', () => {
	it('is null when there are no polygons to select', () => {
		const picker = new SegmentRangePicker(() => []);
		expect(picker.range).toBeNull();
	});
});

describe('SegmentRangePicker.hitTestHandle', () => {
	it('returns null when there is no selection yet (no polygons)', () => {
		const picker = new SegmentRangePicker(() => []);
		expect(picker.hitTestHandle({ x: 100, y: 90 }, 1)).toBeNull();
	});

	it('hits the nearer of the two handles within radius', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(0, false);
		picker.selectVertebra(3, true); // range = [0, 3], superior handle at L3 top (100,40), inferior at S1 bottom (100,210)
		expect(picker.hitTestHandle({ x: 100, y: 42 }, 1)).toBe('superior');
		expect(picker.hitTestHandle({ x: 100, y: 208 }, 1)).toBe('inferior');
	});

	it('returns null beyond the hit radius', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(0, false);
		picker.selectVertebra(3, true);
		expect(picker.hitTestHandle({ x: 1000, y: 1000 }, 1)).toBeNull();
	});
});

describe('SegmentRangePicker drag lifecycle', () => {
	it('beginDragHandle sets isDragging and captures the pointer', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(1, false);
		const target = new FakeElement();

		picker.beginDragHandle(fake_pointer_event({ target: target as any }), 'superior');

		expect(picker.isDragging).toBe(true);
		expect(target.setPointerCapture).toHaveBeenCalled();
	});

	it('updateDragHandle snaps the dragged handle to the nearest vertebra by its own plate', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(1, false); // single selection at L5 (index 1)
		picker.beginDragHandle(fake_pointer_event(), 'superior');

		// Near L3's top plate (100, 40).
		picker.updateDragHandle({ x: 100, y: 42 });

		expect(picker.superiorIndex).toBe(3);
		expect(picker.inferiorIndex).toBe(1);
	});

	it('clamps the dragged handle so it can never cross the other one', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(0, false);
		picker.selectVertebra(2, true); // range = [0, 2]
		picker.beginDragHandle(fake_pointer_event(), 'inferior');

		// Try to drag the inferior handle above the superior handle (toward L3, index 3).
		picker.updateDragHandle({ x: 100, y: 42 });

		expect(picker.inferiorIndex).toBe(2); // clamped to the superior handle's index, not 3
		expect(picker.superiorIndex).toBe(2);
	});

	it('endDragHandle releases the pointer and clears isDragging', () => {
		const picker = new SegmentRangePicker(() => four_vertebrae());
		picker.selectVertebra(1, false);
		const target = new FakeElement();
		picker.beginDragHandle(fake_pointer_event({ target: target as any }), 'superior');

		picker.endDragHandle(fake_pointer_event({ target: target as any }));

		expect(picker.isDragging).toBe(false);
		expect(target.releasePointerCapture).toHaveBeenCalled();
	});
});
