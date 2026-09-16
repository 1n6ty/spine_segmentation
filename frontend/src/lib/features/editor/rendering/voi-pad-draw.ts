/**
 * Draws the 2D VOI (window center/width) pad: a small square with a crosshair at the current
 * position, `fraction` being 0..1 for both axes (X = window center, Y = window width) exactly as
 * `DisplayController.padFraction` computes it. Sync-to-devicePixelRatio pattern mirrors
 * `minimap-draw.ts`'s `drawMinimap`.
 */
export function drawVoiPad(ctx: CanvasRenderingContext2D, fraction: { tx: number; ty: number }) {
	const dpr = window.devicePixelRatio || 1;
	const displayW = ctx.canvas.clientWidth;
	const displayH = ctx.canvas.clientHeight;

	if (ctx.canvas.width !== displayW * dpr || ctx.canvas.height !== displayH * dpr) {
		ctx.canvas.width = displayW * dpr;
		ctx.canvas.height = displayH * dpr;
	}

	ctx.save();
	ctx.scale(dpr, dpr);
	ctx.clearRect(0, 0, displayW, displayH);

	ctx.fillStyle = '#f3f4f6';
	ctx.fillRect(0, 0, displayW, displayH);

	// Center gridlines, for a visual reference point.
	ctx.strokeStyle = '#d1d5db';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(displayW / 2, 0);
	ctx.lineTo(displayW / 2, displayH);
	ctx.moveTo(0, displayH / 2);
	ctx.lineTo(displayW, displayH / 2);
	ctx.stroke();

	const px = fraction.tx * displayW;
	const py = fraction.ty * displayH;

	ctx.strokeStyle = '#ef4444'; // matches the minimap's viewport-rect red
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(px, 0);
	ctx.lineTo(px, displayH);
	ctx.moveTo(0, py);
	ctx.lineTo(displayW, py);
	ctx.stroke();

	ctx.fillStyle = '#ef4444';
	ctx.beginPath();
	ctx.arc(px, py, 4, 0, Math.PI * 2);
	ctx.fill();

	ctx.strokeStyle = '#9ca3af';
	ctx.lineWidth = 1;
	ctx.strokeRect(0.5, 0.5, displayW - 1, displayH - 1);

	ctx.restore();
}
