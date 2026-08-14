import { centroid } from '$lib/shared/geometry/geometry';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { drawCircle } from '$lib/shared/canvas/canvas-utils';

function drawBackground(
	ctx: CanvasRenderingContext2D,
	image: ImageBitmap,
	offset: Point,
	scale: number
): void {
	// 1. Sync internal resolution to display size
	ctx.canvas.width = ctx.canvas.clientWidth;
	ctx.canvas.height = ctx.canvas.clientHeight;

	// 2. Set Scaling Quality
	// 'high' is best for medical scans.
	// Use 'pixelated' if you want zero blur when zooming in deep.
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';

	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

	ctx.save();
	ctx.translate(offset.x, offset.y);
	ctx.scale(scale, scale);

	ctx.drawImage(image, 0, 0);
	ctx.restore();
}

function drawPolygons(
	ctx: CanvasRenderingContext2D,
	polygons: Polygon[],
	selectedPolygon: Polygon | null,
	pointsRadius: number,
	scale: number
): void {
	// Draw Polygons & Labels
	const invScale = 1 / scale;
	ctx.lineWidth = 2 * invScale;

	for (const poly of polygons) {
		const isSelected = poly.id === selectedPolygon?.id;

		// Path
		ctx.beginPath();
		poly.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
		ctx.closePath();
		ctx.strokeStyle = isSelected ? 'red' : 'lime';
		ctx.stroke();

		// Label
		const minX = Math.min(...poly.points.map((p) => p.x));
		const centerY = centroid(poly.points).y;
		ctx.fillStyle = 'yellow';
		ctx.font = `${22 * invScale}px sans-serif`;
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(poly.id, minX - 5 * invScale, centerY);

		// Vertices
		for (const p of poly.points) {
			drawCircle(ctx, p, pointsRadius * invScale, isSelected ? 'red' : 'lime');
		}
	}
}

function drawDraftPoints(
	ctx: CanvasRenderingContext2D,
	points: Point[],
	pointsRadius: number,
	scale: number
): void {
	if (points.length === 0) return;

	const invScale = 1 / scale;

	ctx.beginPath();
	// Line stays 2px wide on your monitor, no matter the zoom
	ctx.lineWidth = 2 * invScale;
	ctx.strokeStyle = 'cyan';

	points.forEach((p, i) => {
		i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
	});
	ctx.stroke();

	// Points stay the same size on your monitor
	points.forEach((p) => {
		drawCircle(ctx, p, pointsRadius * invScale, 'cyan');
	});
}

export function drawMain(
	ctx: CanvasRenderingContext2D,
	bitmap: ImageBitmap,
	polygons: Polygon[],
	selectedPolygon: Polygon | null,
	draftPoints: Point[],
	view: { offset: Point; scale: number },
	pointsRadius: number = 6
) {
	drawBackground(ctx, bitmap, view.offset, view.scale);

	ctx.save();
	ctx.translate(view.offset.x, view.offset.y);
	ctx.scale(view.scale, view.scale);

	drawPolygons(ctx, polygons, selectedPolygon, pointsRadius, view.scale);

	drawDraftPoints(ctx, draftPoints, pointsRadius, view.scale);

	ctx.restore();
}
