import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SegmentRangePicker, nearestVertebraIndex } from './segment-range-picker.svelte';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

// Five vertebrae stacked vertically, spine-ordered (index 0 = inferior-most), matching the
// [bottom-left, top-left, top-right, bottom-right] convention `orderer.ts` guarantees upstream.
function square_at(id: string, cx: number, cy: number): Polygon {
	const h = 5;
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

const polygons = [
	square_at('S1', 0, 400),
	square_at('L5', 0, 300),
	square_at('L4', 0, 200),
	square_at('L3', 0, 100),
	square_at('L2', 0, 0)
];

class FakeElement {
	setPointerCapture = vi.fn();
	releasePointerCapture = vi.fn();
}

function fake_pointer_event(overrides: Partial<PointerEvent> = {}): PointerEvent {
	return {
		pointerId: 1,
		target: new FakeElement(),
		...overrides
	} as unknown as PointerEvent;
}

let picker: SegmentRangePicker;

beforeEach(() => {
	vi.stubGlobal('Element', FakeElement);
	picker = new SegmentRangePicker(() => polygons);
});

describe('nearestVertebraIndex', () => {
	it('returns the polygon whose centroid is closest, even when the point is nowhere near it', () => {
		// Equidistant (in y) between index 1 (cy=300) and index 2 (cy=200) -- ties favor the
		// earlier index, matching the strict `<` comparison and forward iteration order.
		expect(nearestVertebraIndex(polygons, { x: 5000, y: 250 })).toBe(1);
	});

	it('returns an exact centroid match when the point lands dead-center on a vertebra', () => {
		expect(nearestVertebraIndex(polygons, { x: 0, y: 0 })).toBe(4); // L2's own centroid
	});

	it('never returns null/undefined -- always resolves to some index', () => {
		expect(nearestVertebraIndex(polygons, { x: -99999, y: 99999 })).toBeTypeOf('number');
	});
});

describe('SegmentRangePicker body-drag', () => {
	it('beginDragBody has the same immediate effect as a plain click: single-vertebra selection and pointer capture', () => {
		const target = new FakeElement();
		picker.beginDragBody(fake_pointer_event({ target: target as any }), 1);

		expect(picker.superiorIndex).toBe(1);
		expect(picker.inferiorIndex).toBe(1);
		expect(picker.isDraggingBody).toBe(true);
		expect(target.setPointerCapture).toHaveBeenCalledWith(1);
	});

	it('updateDragBody live-extends the range to whatever vertebra body is under the pointer', () => {
		picker.beginDragBody(fake_pointer_event(), 1);

		picker.updateDragBody({ x: 0, y: 100 }); // over polygon index 3 (L3)

		expect(picker.inferiorIndex).toBe(1);
		expect(picker.superiorIndex).toBe(3);
	});

	it('updateDragBody shrinks the range back when the pointer returns toward the anchor', () => {
		picker.beginDragBody(fake_pointer_event(), 1);
		picker.updateDragBody({ x: 0, y: 100 }); // extend to index 3
		picker.updateDragBody({ x: 0, y: 300 }); // back to index 1 (the anchor itself)

		expect(picker.inferiorIndex).toBe(1);
		expect(picker.superiorIndex).toBe(1);
	});

	it('updateDragBody is unbounded -- it always tracks the nearest vertebra, even far outside every body', () => {
		picker.beginDragBody(fake_pointer_event(), 1);
		picker.updateDragBody({ x: 0, y: 100 }); // extend to index 3

		// Far past every polygon -- nearest by centroid distance is still well-defined (index 0,
		// S1 at cy=400, the closest of the 5 centroids to this point since 400 is nearer 9999
		// than 300/200/100/0 are).
		picker.updateDragBody({ x: 9999, y: 9999 });

		expect(picker.inferiorIndex).toBe(0);
		expect(picker.superiorIndex).toBe(1);
	});

	it('updateDragBody keeps tracking loosely -- a point nowhere near any body still resolves to the nearest one', () => {
		picker.beginDragBody(fake_pointer_event(), 2);

		// Far off to the side, roughly level with polygon index 2 (L4, cy=200) -- nearest by
		// centroid distance despite not being over any body at all.
		picker.updateDragBody({ x: 500, y: 200 });

		expect(picker.inferiorIndex).toBe(2);
		expect(picker.superiorIndex).toBe(2);
	});

	it('updateDragBody before any beginDragBody call is a no-op', () => {
		picker.updateDragBody({ x: 0, y: 100 });

		// Constructor default: full spine selected.
		expect(picker.inferiorIndex).toBe(0);
		expect(picker.superiorIndex).toBe(4);
	});

	it('endDragBody clears the dragging flag and releases pointer capture', () => {
		const target = new FakeElement();
		picker.beginDragBody(fake_pointer_event({ target: target as any }), 1);

		picker.endDragBody(fake_pointer_event({ target: target as any }));

		expect(picker.isDraggingBody).toBe(false);
		expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
	});

	it('a beginDragBody with no subsequent movement leaves the same single-vertebra range a plain click would produce', () => {
		picker.beginDragBody(fake_pointer_event(), 2);
		picker.endDragBody(fake_pointer_event());

		const reference = new SegmentRangePicker(() => polygons);
		reference.selectVertebra(2, false);

		expect(picker.superiorIndex).toBe(reference.superiorIndex);
		expect(picker.inferiorIndex).toBe(reference.inferiorIndex);
	});

	it('a body-drag resets the anchor, so a later Shift+click extends from the drag start vertebra', () => {
		picker.selectVertebra(0, false); // anchor = 0
		picker.beginDragBody(fake_pointer_event(), 2); // new anchor = 2
		picker.updateDragBody({ x: 0, y: 0 }); // extend to index 4
		picker.endDragBody(fake_pointer_event());

		picker.selectVertebra(1, true); // Shift+click index 1, from anchor 2

		expect(picker.inferiorIndex).toBe(1);
		expect(picker.superiorIndex).toBe(2);
	});
});
