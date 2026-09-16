import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { drawVoiPad } from './voi-pad-draw';

function fake_ctx(clientWidth: number, clientHeight: number) {
	return {
		canvas: { width: 0, height: 0, clientWidth, clientHeight },
		save: vi.fn(),
		restore: vi.fn(),
		scale: vi.fn(),
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		strokeRect: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		stroke: vi.fn(),
		fill: vi.fn(),
		arc: vi.fn(),
		strokeStyle: '',
		fillStyle: '',
		lineWidth: 1
	} as unknown as CanvasRenderingContext2D & { canvas: { width: number; height: number } };
}

beforeEach(() => {
	vi.stubGlobal('window', { devicePixelRatio: 1 });
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('drawVoiPad', () => {
	it('resizes the backing store to displaySize * devicePixelRatio when it does not already match', () => {
		vi.stubGlobal('window', { devicePixelRatio: 2 });
		const ctx = fake_ctx(100, 80);

		drawVoiPad(ctx, { tx: 0.5, ty: 0.5 });

		expect(ctx.canvas.width).toBe(200);
		expect(ctx.canvas.height).toBe(160);
		expect(ctx.scale).toHaveBeenCalledWith(2, 2);
	});

	it('does not resize the backing store when it already matches the target size', () => {
		const ctx = fake_ctx(100, 80);
		ctx.canvas.width = 100;
		ctx.canvas.height = 80;

		drawVoiPad(ctx, { tx: 0.5, ty: 0.5 });

		expect(ctx.canvas.width).toBe(100);
		expect(ctx.canvas.height).toBe(80);
	});

	it('draws the crosshair dot at the fraction-mapped pad position', () => {
		const ctx = fake_ctx(100, 80);

		drawVoiPad(ctx, { tx: 0.25, ty: 0.75 });

		expect(ctx.arc).toHaveBeenCalledWith(25, 60, 4, 0, Math.PI * 2);
	});

	it('clears and fills the pad background before drawing the crosshair', () => {
		const ctx = fake_ctx(100, 80);

		drawVoiPad(ctx, { tx: 0.5, ty: 0.5 });

		expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 100, 80);
		expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 80);
	});
});
