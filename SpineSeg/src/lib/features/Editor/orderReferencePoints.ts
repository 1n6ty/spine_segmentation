import { getDistance, getPolygonCenter, getSignedAngle } from "$lib/utils/geometry/geometry";
import type { Polygon } from "$lib/utils/geometry/geometry.type";

export function orderReferencePoints(
    polygon: Polygon,
    nearestPolygon: Polygon,
    pos: "up" | "down"
): void {
    const nearestCenter = getPolygonCenter(nearestPolygon);

    // 1. Find the distances from each point to the nearest polygon's center
    const distances = polygon.points.map((p, index) => ({
        p,
        index,
        dist: getDistance(p, nearestCenter)
    }));
    
    // Sort to find the 2 nearest points
    distances.sort((a, b) => a.dist - b.dist);
    
    const nearestIndices = [distances[0].index, distances[1].index];
    const nearestPoints = [distances[0].p, distances[1].p];
    
    // Get the remaining points
    const otherPoints = polygon.points.filter((_, i) => !nearestIndices.includes(i));

    // 2. Assign up/down points by wrapping them in temporary Polygon objects
    // This makes them compatible with your getPolygonCenter utility
    let up: Polygon;
    let down: Polygon;

    if (pos === "up") {
        up = { id: "temp_up", points: nearestPoints };
        down = { id: "temp_down", points: otherPoints };
    } else {
        down = { id: "temp_down", points: nearestPoints };
        up = { id: "temp_up", points: otherPoints };
    }

    // 3. Calculate averages and main vector
    const downAvg = getPolygonCenter(down);
    const upAvg = getPolygonCenter(up);
    const mainVec = { x: upAvg.x - downAvg.x, y: upAvg.y - downAvg.y };

    // 4. Calculate signed angles and sort
    const angles = polygon.points.map(p => {
        const vecToPoint = { x: p.x - downAvg.x, y: p.y - downAvg.y };
        return {
            point: p,
            angle: getSignedAngle(mainVec, vecToPoint)
        };
    });

    // Sort descending (replicating np.argsort()[::-1])
    angles.sort((a, b) => b.angle - a.angle);

    // Apply the newly ordered points back to the polygon
    polygon.points = angles.map(item => item.point);
}