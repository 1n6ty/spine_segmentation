import { describe, it, expect, vi } from 'vitest';
import { drawCircle, drawDiamond, getClampedOffset } from './canvas-utils';

function fake_ctx() {
	return {
		save: vi.fn(),
		restore: vi.fn(),
		beginPath: vi.fn(),
		closePath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		stroke: vi.fn(),
		fillStyle: '',
		strokeStyle: '',
		lineWidth: 4
	} as unknown as CanvasRenderingContext2D;
}

describe('drawCircle', () => {
	it('draws an arc at the given point/radius, filled and stroked', () => {
		const ctx = fake_ctx();
		drawCircle(ctx, { x: 10, y: 20 }, 5, 'red');

		expect(ctx.save).toHaveBeenCalled();
		expect(ctx.beginPath).toHaveBeenCalled();
		expect(ctx.arc).toHaveBeenCalledWith(10, 20, 5, 0, Math.PI * 2);
		expect(ctx.fillStyle).toBe('red');
		expect(ctx.fill).toHaveBeenCalled();
		expect(ctx.strokeStyle).toBe('black');
		expect(ctx.stroke).toHaveBeenCalled();
		expect(ctx.restore).toHaveBeenCalled();
	});

	it('halves lineWidth for the stroke outline', () => {
		const ctx = fake_ctx();
		ctx.lineWidth = 4;
		drawCircle(ctx, { x: 0, y: 0 }, 5, 'lime');
		expect(ctx.lineWidth).toBe(2);
	});
});

describe('drawDiamond', () => {
	it('draws a closed 4-point path centered at the given point, filled and stroked', () => {
		const ctx = fake_ctx();
		drawDiamond(ctx, { x: 10, y: 20 }, 5, 'orange');

		expect(ctx.moveTo).toHaveBeenCalledWith(10, 15);
		expect(ctx.lineTo).toHaveBeenCalledWith(15, 20);
		expect(ctx.lineTo).toHaveBeenCalledWith(10, 25);
		expect(ctx.lineTo).toHaveBeenCalledWith(5, 20);
		expect(ctx.closePath).toHaveBeenCalled();
		expect(ctx.fillStyle).toBe('orange');
		expect(ctx.fill).toHaveBeenCalled();
		expect(ctx.stroke).toHaveBeenCalled();
	});
});

describe('getClampedOffset', () => {
	const bitmap = { width: 200, height: 100 } as ImageBitmap;

	it('centers a smaller-than-canvas image on both axes, ignoring the requested offset', () => {
		const result = getClampedOffset({ x: 999, y: 999 }, 1, bitmap, { width: 400, height: 300 });
		expect(result).toEqual({ x: 100, y: 100 });
	});

	it('clamps a larger-than-canvas image so it can never reveal a blank edge past 0', () => {
		// scale=2 -> scaled image is 400x200; canvas is 300x150, smaller on both axes.
		const result = getClampedOffset({ x: 500, y: 500 }, 2, bitmap, { width: 300, height: 150 });
		expect(result).toEqual({ x: 0, y: 0 });
	});

	it('clamps a too-negative offset so the image never scrolls past its far edge', () => {
		const result = getClampedOffset({ x: -1000, y: -1000 }, 2, bitmap, { width: 300, height: 150 });
		// min offset = canvasSize - scaledSize = 300-400=-100, 150-200=-50
		expect(result).toEqual({ x: -100, y: -50 });
	});
});
