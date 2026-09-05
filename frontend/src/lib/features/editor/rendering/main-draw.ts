import { centroid } from '$lib/shared/geometry/geometry';
import type { Point, Polygon } from '$lib/shared/geometry/geometry.type';
import { drawCircle, drawDiamond } from '$lib/shared/canvas/canvas-utils';
import type { CentralPath } from '$lib/shared/anatomy/central-path';
import { SIDE_INDICES, type SelectionEntry, type Side } from '../core/selection-state.svelte';

const ALL_SIDES: readonly Side[] = ['left', 'right', 'top', 'bottom'];

interface PolygonSelectionView {
	/** Whole vertebra selected -- full red outline + all 4 vertices red. */
	vertebra: boolean;
	/** Per-vertex red state -- true if that index is covered by ANY selected entry touching this
	 * polygon (vertebra, a side containing it, or the point itself). An edge is drawn red purely
	 * by both its endpoints being red here (see `drawPolygons`), not a separate flag -- so two
	 * independently point-selected corners of the same edge (e.g. two Ctrl+clicks) light up the
	 * edge between them exactly like an explicit side selection would. */
	pointRed: [boolean, boolean, boolean, boolean];
}

const UNSELECTED_VIEW: PolygonSelectionView = {
	vertebra: false,
	pointRed: [false, false, false, false]
};

/** Groups a flat selection into per-polygon views once per frame, rather than re-scanning the
 * whole selection for every polygon in `drawPolygons`'s loop. */
function groupSelectionByPolygon(entries: SelectionEntry[]): Map<string, PolygonSelectionView> {
	const byPolygon = new Map<string, PolygonSelectionView>();

	const viewFor = (polygonUuid: string): PolygonSelectionView => {
		let view = byPolygon.get(polygonUuid);
		if (!view) {
			view = { vertebra: false, pointRed: [false, false, false, false] };
			byPolygon.set(polygonUuid, view);
		}
		return view;
	};

	for (const entry of entries) {
		const view = viewFor(entry.polygonUuid);
		if (entry.kind === 'vertebra') {
			view.vertebra = true;
			view.pointRed = [true, true, true, true];
		} else if (entry.kind === 'side') {
			for (const i of SIDE_INDICES[entry.side]) view.pointRed[i] = true;
		} else {
			view.pointRed[entry.pointIndex] = true;
		}
	}

	return byPolygon;
}

export function drawBackground(
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

export function drawPolygons(
	ctx: CanvasRenderingContext2D,
	polygons: Polygon[],
	selectedEntries: SelectionEntry[],
	pointsRadius: number,
	scale: number
): void {
	const invScale = 1 / scale;
	ctx.lineWidth = 2 * invScale;
	const byPolygon = groupSelectionByPolygon(selectedEntries);

	for (const poly of polygons) {
		const view = byPolygon.get(poly.uuid) ?? UNSELECTED_VIEW;

		// Path -- red only when the WHOLE vertebra is selected; a side-only selection keeps this
		// lime and draws just its own edge red separately below.
		ctx.beginPath();
		poly.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
		ctx.closePath();
		ctx.strokeStyle = view.vertebra ? 'red' : 'lime';
		ctx.stroke();

		// Any edge whose BOTH endpoints are red gets drawn red too -- covers an explicit side
		// selection, but just as much two independently point-selected corners that happen to
		// share an edge (e.g. two separate Ctrl+clicks), which should look identical.
		if (!view.vertebra && poly.points.length === 4) {
			for (const side of ALL_SIDES) {
				const [a, b] = SIDE_INDICES[side];
				if (!view.pointRed[a] || !view.pointRed[b]) continue;

				ctx.beginPath();
				ctx.moveTo(poly.points[a].x, poly.points[a].y);
				ctx.lineTo(poly.points[b].x, poly.points[b].y);
				ctx.strokeStyle = 'red';
				ctx.stroke();
			}
		}

		// Label
		const minX = Math.min(...poly.points.map((p) => p.x));
		const centerY = centroid(poly.points).y;
		ctx.fillStyle = 'yellow';
		ctx.font = `${22 * invScale}px sans-serif`;
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(poly.id, minX - 5 * invScale, centerY);

		// Vertices
		poly.points.forEach((p, i) => {
			drawCircle(ctx, p, pointsRadius * invScale, view.pointRed[i] ? 'red' : 'lime');
		});
	}
}

function drawCentralLine(
	ctx: CanvasRenderingContext2D,
	centralPath: CentralPath | null,
	pointsRadius: number,
	scale: number
): void {
	if (!centralPath) return;

	const invScale = 1 / scale;
	const samples = centralPath.samplePoints();

	if (samples.length > 1) {
		ctx.beginPath();
		ctx.lineWidth = 2 * invScale;
		ctx.strokeStyle = 'orange';
		samples.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
		ctx.stroke();
	}

	for (const controlPoint of centralPath.controlPoints) {
		drawDiamond(ctx, controlPoint.point, pointsRadius * 0.7 * invScale, 'orange');
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

	points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
	ctx.stroke();

	// Points stay the same size on your monitor
	points.forEach((p) => {
		drawCircle(ctx, p, pointsRadius * invScale, 'cyan');
	});
}

function drawSelectionBox(
	ctx: CanvasRenderingContext2D,
	box: { start: Point; current: Point },
	scale: number
): void {
	const invScale = 1 / scale;

	ctx.save();
	ctx.setLineDash([6 * invScale, 4 * invScale]);
	ctx.lineWidth = 1.5 * invScale;
	ctx.strokeStyle = 'white';
	ctx.strokeRect(
		Math.min(box.start.x, box.current.x),
		Math.min(box.start.y, box.current.y),
		Math.abs(box.current.x - box.start.x),
		Math.abs(box.current.y - box.start.y)
	);
	ctx.restore();
}

export function drawMain(
	ctx: CanvasRenderingContext2D,
	bitmap: ImageBitmap,
	polygons: Polygon[],
	selectedEntries: SelectionEntry[],
	draftPoints: Point[],
	view: { offset: Point; scale: number },
	box: { start: Point; current: Point } | null = null,
	pointsRadius: number = 6,
	centralPath: CentralPath | null = null
) {
	drawBackground(ctx, bitmap, view.offset, view.scale);

	ctx.save();
	ctx.translate(view.offset.x, view.offset.y);
	ctx.scale(view.scale, view.scale);

	drawPolygons(ctx, polygons, selectedEntries, pointsRadius, view.scale);

	drawCentralLine(ctx, centralPath, pointsRadius, view.scale);

	drawDraftPoints(ctx, draftPoints, pointsRadius, view.scale);

	if (box) drawSelectionBox(ctx, box, view.scale);

	ctx.restore();
}
