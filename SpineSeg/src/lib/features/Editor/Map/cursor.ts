import type { Point, Polygon } from "$lib/utils/geometry/geometry.type";
import type { BitmapMeta, BitmapOptions } from "../editor.type";

function getPointUnderCursor(bitmapMeta: BitmapMeta, bitmapOptions: BitmapOptions, point: Point, polygons: Polygon[], points: Point[] = []): { poly: Polygon; index: number } | null {
    if (!bitmapMeta.pointsMeta) return null;
    // Check points of completed polygons (top-most first)
    for (let i = polygons.length - 1; i >= 0; i--) {
        const poly = polygons[i];
        for (let j = 0; j < poly.points.length; j++) {
            const p = poly.points[j];
            const px = p.x * bitmapMeta.scale.x + bitmapMeta.offset.x;
            const py = p.y * bitmapMeta.scale.y + bitmapMeta.offset.y;
            const dx = px - point.x;
            const dy = py - point.y;
            if (Math.sqrt(dx*dx + dy*dy) < bitmapMeta.pointsMeta.radius * bitmapOptions.point.hitC) {
                return { poly, index: j };
            }
        }
    }

    // Optional: include currentPoints if polygon being drawn
    for (let j = 0; j < points.length; j++) {
        const p = points[j];
        const px = p.x * bitmapMeta.scale.x + bitmapMeta.offset.x;
        const py = p.y * bitmapMeta.scale.y + bitmapMeta.offset.y;
        const dx = px - point.x;
        const dy = py - point.y;
        if (Math.sqrt(dx*dx + dy*dy) < bitmapMeta.pointsMeta.radius * bitmapOptions.point.hitC) {
            return { poly: { id: "current", points: points }, index: j };
        }
    }

    return null;
}

function getPolygonUnderCursor(bitmapMeta: BitmapMeta, point: Point, polygons: Polygon[]): Polygon | null {
    // Check completed polygons (top-most first)
    for (let i = polygons.length - 1; i >= 0; i--) {
        const poly = polygons[i];
        // Simple bounding box check
        const xs = poly.points.map(p => p.x * bitmapMeta.scale.x + bitmapMeta.offset.x);
        const ys = poly.points.map(p => p.y * bitmapMeta.scale.y + bitmapMeta.offset.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
            return poly;
        }
    }
    return null;
}

export { getPointUnderCursor, getPolygonUnderCursor };