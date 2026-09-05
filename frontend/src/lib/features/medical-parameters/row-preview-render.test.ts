import { describe, it, expect, vi } from 'vitest';
import {
	computeRegionFitTransform,
	drawRegionPreview,
	drawGridOverlay,
	mmPerGridSquare
} from './row-preview-render';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

function fake_ctx() {
	const stroke_styles: string[] = [];
	const ctx = {
		canvas: { width: 0, height: 0, clientWidth: 300, clientHeight: 200 },
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		scale: vi.fn(),
		clearRect: vi.fn(),
		drawImage: vi.fn(),
		beginPath: vi.fn(),
		closePath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		arc: vi.fn(),
		stroke: vi.fn(),
		fill: vi.fn(),
		fillText: vi.fn(),
		fillStyle: '',
		lineWidth: 1,
		font: '',
		textAlign: '',
		textBaseline: '',
		imageSmoothingEnabled: false,
		imageSmoothingQuality: '',
		_strokeStyles: stroke_styles
	};
	Object.defineProperty(ctx, 'strokeStyle', {
		set(v: string) {
			stroke_styles.push(v);
		},
		get() {
			return stroke_styles[stroke_styles.length - 1];
		}
	});
	return ctx as unknown as CanvasRenderingContext2D & { _strokeStyles: string[] };
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

const bitmap = {} as ImageBitmap;

describe('computeRegionFitTransform', () => {
	it('fits a single polygon centered in the canvas, padded beyond its own bounds', () => {
		const poly = square('C2', 0, 0, 10); // 20x20 box centered on origin
		const view = computeRegionFitTransform([poly], 200, 200, 0.5);

		// Padded box is 20 + 2*(0.5*20) = 40 on each side -> scale = 200/40 = 5
		expect(view.scale).toBeCloseTo(5);
		// Centered on the polygon's own center (0,0) -> canvas center offset
		expect(view.offset.x).toBeCloseTo(100);
		expect(view.offset.y).toBeCloseTo(100);
	});

	it('unions multiple polygons into a single fit box', () => {
		const top = square('C2', 0, -50, 10);
		const bottom = square('C3', 0, 50, 10);
		const view = computeRegionFitTransform([top, bottom], 400, 400, 0);

		// Raw box spans y in [-60, 60] -> height 120 -> scale = 400/120
		expect(view.scale).toBeCloseTo(400 / 120);
	});

	it('falls back to identity when there are no points or a degenerate canvas', () => {
		expect(computeRegionFitTransform([], 200, 200)).toEqual({ offset: { x: 0, y: 0 }, scale: 1 });
		expect(computeRegionFitTransform([square('C2', 0, 0)], 0, 200)).toEqual({
			offset: { x: 0, y: 0 },
			scale: 1
		});
	});
});

describe('drawRegionPreview', () => {
	it('draws the cropped bitmap under the given transform', () => {
		const ctx = fake_ctx();
		const view = { offset: { x: 5, y: 7 }, scale: 2 };

		drawRegionPreview(ctx, bitmap, view, []);

		expect(ctx.translate).toHaveBeenCalledWith(5, 7);
		expect(ctx.scale).toHaveBeenCalledWith(2, 2);
		expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
	});

	it('outlines every highlight polygon', () => {
		const ctx = fake_ctx();
		const poly = square('C2', 0, 0);
		const view = { offset: { x: 0, y: 0 }, scale: 1 };

		drawRegionPreview(ctx, bitmap, view, [poly]);

		expect(ctx.moveTo).toHaveBeenCalledWith(poly.points[0].x, poly.points[0].y);
		expect(ctx.closePath).toHaveBeenCalled();
	});
});

describe('drawGridOverlay', () => {
	it('draws one vertical and one horizontal line per spacing step across the canvas', () => {
		const ctx = fake_ctx();

		drawGridOverlay(ctx, 100, 60, 20);

		// x = 0, 20, 40, 60, 80, 100 -> 6 vertical lines; y = 0, 20, 40, 60 -> 4 horizontal
		expect(ctx.moveTo).toHaveBeenCalledTimes(10);
		expect(ctx.lineTo).toHaveBeenCalledTimes(10);
		expect(ctx.stroke).toHaveBeenCalledTimes(1);
	});
});

describe('mmPerGridSquare', () => {
	it('converts a fixed screen-pixel spacing into mm using the current fit scale', () => {
		const view = { offset: { x: 0, y: 0 }, scale: 4 };
		// 32 screen px / 4 scale = 8 image px per grid square; 0.25 mm/px -> 2mm/square
		expect(mmPerGridSquare(view, 0.25, 32)).toBeCloseTo(2);
	});

	it('scales inversely with zoom -- a tighter crop (higher scale) means fewer mm per square', () => {
		const mmPerPixel = 0.3;
		const loose = mmPerGridSquare({ offset: { x: 0, y: 0 }, scale: 1 }, mmPerPixel);
		const tight = mmPerGridSquare({ offset: { x: 0, y: 0 }, scale: 5 }, mmPerPixel);
		expect(tight).toBeLessThan(loose);
	});
});
