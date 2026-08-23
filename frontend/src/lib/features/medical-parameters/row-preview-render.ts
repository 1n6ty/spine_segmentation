import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { aabb_of_points } from '$lib/shared/geometry/geometry';
import { drawBackground, drawPolygons } from '$lib/features/editor/rendering/main-draw';

export interface View {
	offset: Point;
	scale: number;
}

/** Fits `polygons`' combined bounding box into `canvasWidth`x`canvasHeight`, padded by
 * `paddingRatio` of the box's own larger dimension on every side -- proportional to the row's
 * own size (rather than a fixed pixel amount) so a single small vertebra still shows a slice
 * of its neighbors for context, while a large segment isn't padded by an equally tiny amount. */
export function computeRegionFitTransform(
	polygons: Polygon[],
	canvasWidth: number,
	canvasHeight: number,
	paddingRatio = 0.2
): View {
	const allPoints = polygons.flatMap((p) => p.points);
	if (allPoints.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) {
		return { offset: { x: 0, y: 0 }, scale: 1 };
	}
	const box = aabb_of_points(allPoints);
	const rawW = Math.max(box.maxX - box.minX, 1);
	const rawH = Math.max(box.maxY - box.minY, 1);
	const pad = paddingRatio * Math.max(rawW, rawH);

	const boxW = rawW + pad * 2;
	const boxH = rawH + pad * 2;
	const centerX = (box.minX + box.maxX) / 2;
	const centerY = (box.minY + box.maxY) / 2;

	const scale = Math.min(canvasWidth / boxW, canvasHeight / boxH);
	const offset = {
		x: canvasWidth / 2 - centerX * scale,
		y: canvasHeight / 2 - centerY * scale
	};
	return { offset, scale };
}

/** Draws the cropped bitmap region under `view`'s transform, then outlines `highlightPolygons`
 * (the hovered row's own vertebra/segment/gap) in-place using the editor's own "selected"
 * polygon styling, so it's unambiguous which structure the preview refers to. */
export function drawRegionPreview(
	ctx: CanvasRenderingContext2D,
	bitmap: ImageBitmap,
	view: View,
	highlightPolygons: Polygon[]
): void {
	drawBackground(ctx, bitmap, view.offset, view.scale);

	ctx.save();
	ctx.translate(view.offset.x, view.offset.y);
	ctx.scale(view.scale, view.scale);
	drawPolygons(ctx, highlightPolygons, () => true, 6, view.scale);
	ctx.restore();
}

/** Screen-space (untransformed) grid overlay, drawn every `spacingPx` regardless of zoom --
 * pairs with `mmPerGridSquare` below, which converts that fixed screen spacing into the
 * real-world size it currently represents at `view.scale`. */
export function drawGridOverlay(
	ctx: CanvasRenderingContext2D,
	canvasWidth: number,
	canvasHeight: number,
	spacingPx = 32
): void {
	ctx.save();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
	ctx.lineWidth = 1;

	ctx.beginPath();
	for (let x = 0; x <= canvasWidth; x += spacingPx) {
		ctx.moveTo(x, 0);
		ctx.lineTo(x, canvasHeight);
	}
	for (let y = 0; y <= canvasHeight; y += spacingPx) {
		ctx.moveTo(0, y);
		ctx.lineTo(canvasWidth, y);
	}
	ctx.stroke();
	ctx.restore();
}

/** Real-world size (in mm) of one grid square at the current fit scale. */
export function mmPerGridSquare(view: View, mmPerPixel: number, spacingPx = 32): number {
	return (spacingPx / view.scale) * mmPerPixel;
}
