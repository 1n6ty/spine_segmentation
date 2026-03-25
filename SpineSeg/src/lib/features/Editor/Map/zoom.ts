import type { BitmapMeta, DicomBitmap } from "../editor.type";
import { clampOffset } from "./canvas";
import { draw } from "./draw";
import type { Point, Polygon } from "$lib/utils/geometry/geometry.type";
import { drawMinimap } from "../miniMap/draw";

function zoomAtPoint(miniMapBitmapMeta: BitmapMeta, mainMapBitmapMeta: BitmapMeta, dicomBitmap: DicomBitmap, selectedPolygon: Polygon | null, polygons: Polygon[], points: Point[] = [], factor: number, clientX: number, clientY: number): number {
    if (!mainMapBitmapMeta.canvas) return 0;

    const rect = mainMapBitmapMeta.canvas.getBoundingClientRect();

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const minScale = Math.min(mainMapBitmapMeta.scale.x, mainMapBitmapMeta.scale.y);

    // Compute new scale first
    const newScale = Math.max(mainMapBitmapMeta.scale.min, Math.min(mainMapBitmapMeta.scale.max, minScale * factor));

    // World coordinates under cursor
    const worldX = (x - mainMapBitmapMeta.offset.x) / mainMapBitmapMeta.scale.x;
    const worldY = (y - mainMapBitmapMeta.offset.y) / mainMapBitmapMeta.scale.y;

    // Update scale
    mainMapBitmapMeta.scale.x = newScale;
    mainMapBitmapMeta.scale.y = newScale;

    // Compute offset so cursor stays in place
    mainMapBitmapMeta.offset.x = x - worldX * mainMapBitmapMeta.scale.x;
    mainMapBitmapMeta.offset.y = y - worldY * mainMapBitmapMeta.scale.y;

    // Clamp after updating offset & scale
    clampOffset(mainMapBitmapMeta, dicomBitmap);

    draw(mainMapBitmapMeta, dicomBitmap, selectedPolygon, polygons, points);
    drawMinimap(mainMapBitmapMeta, miniMapBitmapMeta, dicomBitmap);

    return Math.floor(Math.min(mainMapBitmapMeta.scale.x, mainMapBitmapMeta.scale.y) / mainMapBitmapMeta.scale.min * 100);
}

function zoomCenter(miniMapBitmapMeta: BitmapMeta, mainMapBitmapMeta: BitmapMeta, dicomBitmap: DicomBitmap, selectedPolygon: Polygon | null, factor: number, polygons: Polygon[], points: Point[] = []): number {
    if (!mainMapBitmapMeta.canvas) return 0;

    const rect = mainMapBitmapMeta.canvas.getBoundingClientRect();
    return zoomAtPoint(
        miniMapBitmapMeta,
        mainMapBitmapMeta,
        dicomBitmap,
        selectedPolygon,
        polygons,
        points,
        factor,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
    );
}

export { zoomAtPoint, zoomCenter };