import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { aabb_of_points, centroid } from '$lib/shared/geometry/geometry';
import { drawDiamond } from '$lib/shared/canvas/canvas-utils';
import { getPlateMidpoint } from '$lib/shared/anatomy/central-path';
import type { SegmentRangePicker } from './segment-range-picker.svelte';

export interface View {
	offset: Point;
	scale: number;
}

/** Fits every polygon's points into `canvasWidth`x`canvasHeight` with `paddingPx` breathing
 * room, centered -- the AABB-based analogue of the editor's `zoomToFit()` scaleX/scaleY-min +
 * center-offset idiom, keyed off geometry bounds instead of a bitmap's fixed width/height. */
export function computeFitTransform(
	polygons: Polygon[],
	canvasWidth: number,
	canvasHeight: number,
	paddingPx = 32
): View {
	const allPoints = polygons.flatMap((p) => p.points);
	if (allPoints.length === 0 || canvasWidth <= 0 || canvasHeight <= 0) {
		return { offset: { x: 0, y: 0 }, scale: 1 };
	}
	const box = aabb_of_points(allPoints);
	const boxW = Math.max(box.maxX - box.minX, 1);
	const boxH = Math.max(box.maxY - box.minY, 1);

	const scale = Math.min(
		(canvasWidth - paddingPx * 2) / boxW,
		(canvasHeight - paddingPx * 2) / boxH
	);
	const offset = {
		x: canvasWidth / 2 - ((box.minX + box.maxX) / 2) * scale,
		y: canvasHeight / 2 - ((box.minY + box.maxY) / 2) * scale
	};
	return { offset, scale };
}

/**
 * Draws the schematic viewport: the central line (neutral color -- not the editor's orange,
 * which signals an annotation-EDITING affordance elsewhere in the app), each vertebra's real
 * polygon flat-filled and highlighted when inside the current selection, and two diamond
 * handle markers. Handle positions are computed directly from the selected vertebra's own
 * polygon corners (`getPlateMidpoint`) rather than searched for in `centralPath.controlPoints`,
 * since a handle needs to unconditionally resolve to "the top/bottom of vertebra N" regardless
 * of that vertebra's position in the array.
 */
export function drawSegmentRangePicker(
	ctx: CanvasRenderingContext2D,
	picker: SegmentRangePicker,
	view: View
): void {
	ctx.canvas.width = ctx.canvas.clientWidth;
	ctx.canvas.height = ctx.canvas.clientHeight;
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

	ctx.save();
	ctx.translate(view.offset.x, view.offset.y);
	ctx.scale(view.scale, view.scale);
	const invScale = 1 / view.scale;

	const polygons = picker.polygons;
	const { superiorIndex, inferiorIndex } = picker;

	const path = picker.centralPath;
	if (path) {
		const samples = path.samplePoints();
		if (samples.length > 1) {
			ctx.beginPath();
			ctx.lineWidth = 2 * invScale;
			ctx.strokeStyle = '#64748b';
			samples.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
			ctx.stroke();
		}
	}

	polygons.forEach((poly, i) => {
		const selected =
			superiorIndex !== null && inferiorIndex !== null && i >= inferiorIndex && i <= superiorIndex;

		ctx.beginPath();
		poly.points.forEach((p, j) => (j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
		ctx.closePath();
		ctx.fillStyle = selected ? '#93c5fd' : '#e2e8f0';
		ctx.fill();
		ctx.lineWidth = 1.5 * invScale;
		ctx.strokeStyle = selected ? '#2563eb' : '#94a3b8';
		ctx.stroke();

		// Vertebra id label -- same placement convention as the editor's own
		// drawPolygons (main-draw.ts): right-aligned, immediately left of the shape,
		// vertically centered on its centroid. Dark slate instead of the editor's
		// yellow, since this schematic sits on a plain white background rather than
		// over a dark DICOM image.
		const minX = Math.min(...poly.points.map((p) => p.x));
		const centerY = centroid(poly.points).y;
		ctx.fillStyle = selected ? '#1e3a8a' : '#334155';
		ctx.font = `${22 * invScale}px sans-serif`;
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(poly.id, minX - 5 * invScale, centerY);
	});

	if (superiorIndex !== null && inferiorIndex !== null) {
		const superiorPoint = getPlateMidpoint(polygons[superiorIndex], 'top');
		const inferiorPoint = getPlateMidpoint(polygons[inferiorIndex], 'bottom');
		drawDiamond(ctx, superiorPoint, 9 * invScale, '#2563eb');
		drawDiamond(ctx, inferiorPoint, 9 * invScale, '#2563eb');
	}

	ctx.restore();
}
