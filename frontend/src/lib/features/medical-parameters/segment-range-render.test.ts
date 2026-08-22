import { describe, it, expect, vi } from 'vitest';
import { drawSegmentRangePicker } from './segment-range-render';
import { SegmentRangePicker } from './segment-range-picker.svelte';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

function fake_ctx(clientWidth = 400, clientHeight = 300) {
	const fill_styles: string[] = [];
	const stroke_styles: string[] = [];
	const ctx = {
		canvas: { width: 0, height: 0, clientWidth, clientHeight },
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		scale: vi.fn(),
		clearRect: vi.fn(),
		beginPath: vi.fn(),
		closePath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		fill: vi.fn(),
		fillText: vi.fn(),
		lineWidth: 1,
		font: '',
		textAlign: '',
		textBaseline: '',
		_fillStyles: fill_styles,
		_strokeStyles: stroke_styles
	};
	Object.defineProperty(ctx, 'fillStyle', {
		set(v: string) {
			fill_styles.push(v);
		},
		get() {
			return fill_styles[fill_styles.length - 1];
		}
	});
	Object.defineProperty(ctx, 'strokeStyle', {
		set(v: string) {
			stroke_styles.push(v);
		},
		get() {
			return stroke_styles[stroke_styles.length - 1];
		}
	});
	return ctx as unknown as CanvasRenderingContext2D & {
		_fillStyles: string[];
		_strokeStyles: string[];
	};
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

function four_vertebrae(): Polygon[] {
	return [
		square('S1', 100, 200),
		square('L5', 100, 150),
		square('L4', 100, 100),
		square('L3', 100, 50)
	];
}

const view = { offset: { x: 0, y: 0 }, scale: 1 };

describe('drawSegmentRangePicker', () => {
	it('resizes the canvas backing store to its display size and clears it', () => {
		const ctx = fake_ctx(640, 480);
		const picker = new SegmentRangePicker(() => []);

		drawSegmentRangePicker(ctx, picker, view);

		expect(ctx.canvas.width).toBe(640);
		expect(ctx.canvas.height).toBe(480);
		expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
	});

	it('fills once per vertebra polygon, plus 2 for the default full-spine selection handles', () => {
		const ctx = fake_ctx();
		const polys = four_vertebrae();
		const picker = new SegmentRangePicker(() => polys);

		drawSegmentRangePicker(ctx, picker, view);

		expect(ctx.fill).toHaveBeenCalledTimes(polys.length + 2);
	});

	it('uses a distinct fillStyle for vertebrae inside the selected range', () => {
		const ctx = fake_ctx();
		const polys = four_vertebrae();
		const picker = new SegmentRangePicker(() => polys);
		picker.selectVertebra(1, false);
		picker.selectVertebra(2, true); // range = [1, 2] (L5, L4)

		drawSegmentRangePicker(ctx, picker, view);

		expect(ctx._fillStyles).toContain('#93c5fd'); // selected
		expect(ctx._fillStyles).toContain('#e2e8f0'); // unselected
	});

	it('draws no handles when there are no polygons to select', () => {
		const ctx = fake_ctx();
		const picker = new SegmentRangePicker(() => []);

		drawSegmentRangePicker(ctx, picker, view);

		expect(ctx._fillStyles).not.toContain('#2563eb');
	});

	it('draws 2 handles by default, spanning the full spine', () => {
		const ctx = fake_ctx();
		const picker = new SegmentRangePicker(() => four_vertebrae());

		drawSegmentRangePicker(ctx, picker, view);

		const handleFills = ctx._fillStyles.filter((s) => s === '#2563eb');
		expect(handleFills).toHaveLength(2);
	});

	it('draws exactly 2 handles when a selection exists', () => {
		const ctx = fake_ctx();
		const polys = four_vertebrae();
		const picker = new SegmentRangePicker(() => polys);
		picker.selectVertebra(1, false);
		picker.selectVertebra(2, true);

		drawSegmentRangePicker(ctx, picker, view);

		const handleFills = ctx._fillStyles.filter((s) => s === '#2563eb');
		expect(handleFills).toHaveLength(2);
	});

	it('strokes the central line when a central path exists', () => {
		const ctx = fake_ctx();
		const picker = new SegmentRangePicker(() => four_vertebrae());

		drawSegmentRangePicker(ctx, picker, view);

		expect(ctx._strokeStyles).toContain('#64748b');
	});

	it('skips the central-line stroke when there are fewer than 2 vertebrae', () => {
		const ctx = fake_ctx();
		const picker = new SegmentRangePicker(() => [square('S1', 100, 100)]);

		drawSegmentRangePicker(ctx, picker, view);

		expect(ctx._strokeStyles).not.toContain('#64748b');
	});

	it('labels each vertebra with its id, same as the editor', () => {
		const ctx = fake_ctx();
		const polys = four_vertebrae();
		const picker = new SegmentRangePicker(() => polys);

		drawSegmentRangePicker(ctx, picker, view);

		for (const poly of polys) {
			expect(ctx.fillText).toHaveBeenCalledWith(poly.id, expect.any(Number), expect.any(Number));
		}
		expect(ctx.fillText).toHaveBeenCalledTimes(polys.length);
	});
});
