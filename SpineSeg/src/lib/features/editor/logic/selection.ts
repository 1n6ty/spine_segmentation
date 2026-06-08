import type { Point, Polygon } from "$lib/shared/geometry/geometry.type";

/**
 * Finds if a point in world coordinates is close enough to any vertex.
 * @param worldPoint The cursor position in world coordinates
 * @param polygons Completed polygons
 * @param draftPoints Points of the polygon currently being drawn
 * @param worldHitRadius The hit radius converted to world units (pixelRadius / scale)
 */
export function getPointAndPolygonUnderCursor(
    worldPoint: Point,
    polygons: Polygon[],
    worldHitRadius: number
): {point: Point | null, indexInPolygon: number | null, polygon: Polygon | null} {

    // 1. PHASE 1: Check ALL completed polygon vertices first (reverse order)
    for (let i = polygons.length - 1; i >= 0; i--) {
        const poly = polygons[i];
        for (let j = 0; j < poly.points.length; j++) {
            const p = poly.points[j];
            const dx = p.x - worldPoint.x;
            const dy = p.y - worldPoint.y;
            if (Math.sqrt(dx * dx + dy * dy) < worldHitRadius) {
                return {
                    point: { x: p.x, y: p.y },
                    indexInPolygon: j,
                    polygon: poly
                };
            }
        }
    }

    // 2. PHASE 2: If no vertex was hit anywhere, check if cursor is INSIDE a polygon body
    for (let i = polygons.length - 1; i >= 0; i--) {
        const poly = polygons[i];
        if (isPointInPolygon(worldPoint, poly.points)) {
            return {
                point: null,
                indexInPolygon: null,
                polygon: poly
            };
        }
    }

    return {
        point: null,
        indexInPolygon: null,
        polygon: null
    };
}

/**
 * Ray Casting Algorithm to determine if a point is inside a polygon
 */
function isPointInPolygon(point: Point, vertices: Point[]): boolean {
    const { x, y } = point;
    let inside = false;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
    }

    return inside;
}