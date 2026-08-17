import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drawMinimap } from './minimap-draw';

function fake_ctx(clientWidth: number, clientHeight: number) {
	return {
		canvas: { width: 0, height: 0, clientWidth, clientHeight },
		save: vi.fn(),
		restore: vi.fn(),
		scale: vi.fn(),
		clearRect: vi.fn(),
		drawImage: vi.fn(),
		strokeRect: vi.fn(),
		strokeStyle: '',
		lineWidth: 1,
		imageSmoothingEnabled: false,
		imageSmoothingQuality: ''
	} as unknown as CanvasRenderingContext2D & { canvas: { width: number; height: number } };
}

beforeEach(() => {
	vi.stubGlobal('window', { devicePixelRatio: 1 });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const bitmap = { width: 400, height: 200 } as ImageBitmap;

describe('drawMinimap', () => {
	it('resizes the backing store to displaySize * devicePixelRatio when it does not already match', () => {
		vi.stubGlobal('window', { devicePixelRatio: 2 });
		const ctx = fake_ctx(200, 100);

		drawMinimap(ctx, bitmap, { offset: { x: 0, y: 0 }, scale: 1 }, { width: 800, height: 600 });

		expect(ctx.canvas.width).toBe(400);
		expect(ctx.canvas.height).toBe(200);
		expect(ctx.scale).toHaveBeenCalledWith(2, 2);
	});

	it('does not resize the backing store when it already matches the target size', () => {
		const ctx = fake_ctx(200, 100);
		ctx.canvas.width = 200;
		ctx.canvas.height = 100;

		drawMinimap(ctx, bitmap, { offset: { x: 0, y: 0 }, scale: 1 }, { width: 800, height: 600 });

		expect(ctx.canvas.width).toBe(200);
		expect(ctx.canvas.height).toBe(100);
	});

	it('draws the bitmap letterboxed/centered to fit the minimap aspect ratio', () => {
		const ctx = fake_ctx(200, 100); // same 2:1 aspect as the 400x200 bitmap -- ratio 0.5, no letterbox offset
		drawMinimap(ctx, bitmap, { offset: { x: 0, y: 0 }, scale: 1 }, { width: 800, height: 600 });

		expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 200, 100);
	});

	it('draws the main viewport rectangle scaled into minimap space', () => {
		const ctx = fake_ctx(200, 100);
		drawMinimap(ctx, bitmap, { offset: { x: 0, y: 0 }, scale: 1 }, { width: 400, height: 200 });

		// ratio = min(200/400, 100/200) = 0.5; at scale 1 the main viewport is the
		// full 400x200 world, which maps to the full 200x100 minimap image.
		expect(ctx.strokeRect).toHaveBeenCalledWith(0, 0, 200, 100);
	});

	it('shifts the viewport rectangle when the main view is panned', () => {
		const ctx = fake_ctx(200, 100);
		drawMinimap(ctx, bitmap, { offset: { x: -40, y: 0 }, scale: 1 }, { width: 400, height: 200 });

		// world offset of the top-left corner = (0-(-40))/1 = 40 -> shifted by 40*ratio(0.5)=20
		expect(ctx.strokeRect).toHaveBeenCalledWith(20, 0, 200, 100);
	});
});
