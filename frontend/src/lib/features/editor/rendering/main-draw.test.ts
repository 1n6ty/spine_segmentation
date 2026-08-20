import { describe, it, expect, vi } from 'vitest';
import { drawMain } from './main-draw';
import type { Polygon } from '$lib/shared/geometry/geometry.type';
import { computeCentralPath } from '../logic/central-path';

function fake_ctx(clientWidth = 400, clientHeight = 300) {
	const stroke_styles: string[] = [];
	const ctx = {
		canvas: { width: 0, height: 0, clientWidth, clientHeight },
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
		stroke: vi.fn(),
		strokeRect: vi.fn(),
		setLineDash: vi.fn(),
		fill: vi.fn(),
		arc: vi.fn(),
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

const bitmap = {} as ImageBitmap;

const noneSelected = () => false;

describe('drawMain', () => {
	it('resizes the canvas backing store to its display size and clears it', () => {
		const ctx = fake_ctx(640, 480);
		drawMain(ctx, bitmap, [], noneSelected, [], { offset: { x: 0, y: 0 }, scale: 1 });

		expect(ctx.canvas.width).toBe(640);
		expect(ctx.canvas.height).toBe(480);
		expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
	});

	it('draws the background image translated/scaled by the view', () => {
		const ctx = fake_ctx();
		drawMain(ctx, bitmap, [], noneSelected, [], { offset: { x: 5, y: 7 }, scale: 2 });

		expect(ctx.translate).toHaveBeenCalledWith(5, 7);
		expect(ctx.scale).toHaveBeenCalledWith(2, 2);
		expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
	});

	it('strokes each polygon, closing its path, and labels it with its id', () => {
		const ctx = fake_ctx();
		const poly = square('C2', 100, 100);
		drawMain(ctx, bitmap, [poly], noneSelected, [], { offset: { x: 0, y: 0 }, scale: 1 });

		expect(ctx.moveTo).toHaveBeenCalledWith(poly.points[0].x, poly.points[0].y);
		expect(ctx.closePath).toHaveBeenCalled();
		expect(ctx.fillText).toHaveBeenCalledWith('C2', expect.any(Number), expect.any(Number));
	});

	it('strokes selected polygons in red and every other polygon in lime, keyed by uuid', () => {
		const ctx = fake_ctx();
		const selected = square('C2', 0, 0);
		const other = square('C3', 100, 0);

		drawMain(ctx, bitmap, [other, selected], (poly) => poly.uuid === selected.uuid, [], {
			offset: { x: 0, y: 0 },
			scale: 1
		});

		expect(ctx._strokeStyles).toContain('red');
		expect(ctx._strokeStyles).toContain('lime');
	});

	it('draws in-progress draft points as an open cyan polyline when present', () => {
		const ctx = fake_ctx();
		drawMain(
			ctx,
			bitmap,
			[],
			noneSelected,
			[
				{ x: 1, y: 1 },
				{ x: 2, y: 2 }
			],
			{
				offset: { x: 0, y: 0 },
				scale: 1
			}
		);

		expect(ctx.moveTo).toHaveBeenCalledWith(1, 1);
		expect(ctx.lineTo).toHaveBeenCalledWith(2, 2);
		expect(ctx._strokeStyles).toContain('cyan');
	});

	it('skips the draft-points draw entirely when there are none', () => {
		const ctx = fake_ctx();
		drawMain(ctx, bitmap, [], noneSelected, [], { offset: { x: 0, y: 0 }, scale: 1 });

		// No polygons and no draft points -- beginPath (used by both drawPolygons'
		// per-polygon loop and drawDraftPoints) is never reached.
		expect(ctx.beginPath).not.toHaveBeenCalled();
	});

	it('draws a dashed selection box overlay when a box is provided', () => {
		const ctx = fake_ctx();
		drawMain(
			ctx,
			bitmap,
			[],
			noneSelected,
			[],
			{ offset: { x: 0, y: 0 }, scale: 1 },
			{
				start: { x: 0, y: 0 },
				current: { x: 10, y: 10 }
			}
		);

		expect(ctx.strokeRect).toHaveBeenCalledWith(0, 0, 10, 10);
	});

	it('skips the selection box overlay when none is provided', () => {
		const ctx = fake_ctx();
		drawMain(ctx, bitmap, [], noneSelected, [], { offset: { x: 0, y: 0 }, scale: 1 }, null);

		expect(ctx.strokeRect).not.toHaveBeenCalled();
	});

	it('draws the central-line curve and control points in orange when a central path is provided', () => {
		const ctx = fake_ctx();
		// A single vertebra has no interior control points (both its midpoints are
		// spine-outermost and dropped) -- 2 are needed for a non-null central path.
		const polys = [square('S1', 100, 140), square('L5', 100, 100)];
		const centralPath = computeCentralPath(polys);

		drawMain(
			ctx,
			bitmap,
			polys,
			noneSelected,
			[],
			{ offset: { x: 0, y: 0 }, scale: 1 },
			null,
			6,
			centralPath
		);

		expect(ctx._strokeStyles).toContain('orange');
	});

	it('skips the central-line draw entirely when no central path is provided', () => {
		const ctx = fake_ctx();
		drawMain(ctx, bitmap, [], noneSelected, [], { offset: { x: 0, y: 0 }, scale: 1 });

		expect(ctx._strokeStyles).not.toContain('orange');
	});
});
