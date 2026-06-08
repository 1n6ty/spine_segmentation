import { getDistance, getPolygonCenter, getSignedAngle } from "$lib/shared/geometry/geometry";
import type { Point, Polygon } from "$lib/shared/geometry/geometry.type";

const vertebraeNames = [ "S1", "L5", "L4", "L3", "L2", "L1", "Th12", "Th11", "Th10", "Th9", "Th8", "Th7", "Th6", "Th5", "Th4", "Th3", "Th2", "Th1", "C7", "C6", "C5", "C4", "C3", "C2" ]; 

/**
 * Solves the sequence using a Greedy Nearest Neighbor approach.
 */
function solveGreedyTSP(centers: Point[]): number[] {
    if (centers.length === 0) return [];

    // 1. Find the starting point (highest Y value, typically S1 in medical imaging)
    let startIdx = 0;
    let maxY = centers[0].y;
    for (let i = 1; i < centers.length; i++) {
        if (centers[i].y > maxY) {
            maxY = centers[i].y;
            startIdx = i;
        }
    }

    const orderedIndices: number[] = [startIdx];
    const visited = new Set<number>([startIdx]);

    // 2. Iteratively find the nearest unvisited neighbor
    while (orderedIndices.length < centers.length) {
        const lastIdx = orderedIndices[orderedIndices.length - 1];
        const lastPoint = centers[lastIdx];
        
        let nearestIdx = -1;
        let minDistance = Infinity;

        for (let i = 0; i < centers.length; i++) {
            if (visited.has(i)) continue;

            const dist = getDistance(lastPoint, centers[i]);
            if (dist < minDistance) {
                minDistance = dist;
                nearestIdx = i;
            }
        }

        if (nearestIdx !== -1) {
            orderedIndices.push(nearestIdx);
            visited.add(nearestIdx);
        }
    }

    return orderedIndices;
}

function getOrderedReferencePoints(
    polygon: Polygon,
    nearestPolygon: Polygon,
    pos: "up" | "down"
): Polygon {
    if (polygon.points.length === 0) return polygon;

    // 1. Calculate the average (centroid) of the nearest polygon's points
    const nearestAvg = getPolygonCenter(nearestPolygon);

    // 2. Find the 2 closest points to the nearest average (mimicking np.argpartition)
    const indexedDistances = polygon.points.map((p, index) => {
        const distance = Math.sqrt((p.x - nearestAvg.x) ** 2 + (p.y - nearestAvg.y) ** 2);
        return { index, distance };
    });


    // Sort ascending to extract the top 2 closest indices
    indexedDistances.sort((a, b) => b.distance - a.distance);
    const nearestIndexes = [indexedDistances[0].index, indexedDistances[1].index];

    // 3. Separate points into 'up' and 'down' groups based on the 'pos' argument
    const closestPoints = nearestIndexes.map((idx) => polygon.points[idx]);
    const remainingPoints = polygon.points.filter((_, idx) => !nearestIndexes.includes(idx));

    let up: Point[];
    let down: Point[];

    if (pos === "down") {
        up = closestPoints;
        down = remainingPoints;
    } else {
        up = remainingPoints;
        down = closestPoints;
    }

    // 4. Calculate down_avg and the main vector (main_vec)
    const downSum = down.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const downAvg: Point = { x: downSum.x / down.length, y: downSum.y / down.length };

    const upSum = up.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    const upAvg: Point = { x: upSum.x / up.length, y: upSum.y / up.length };

    const mainVec: Point = { x: upAvg.x - downAvg.x, y: upAvg.y - downAvg.y };

    // 5. Calculate signed angles and sort points in descending order (mimicking np.argsort(...)[::-1])
    const pointsWithAngles = polygon.points.map((p) => {
        const vecToPoint: Point = { x: p.x - downAvg.x, y: p.y - downAvg.y };
        const angle = getSignedAngle(mainVec, vecToPoint);
        return { p, angle };
    });

    // Sort descending by angle
    pointsWithAngles.sort((a, b) => b.angle - a.angle);

    console.log({
        uuid: polygon.uuid,
        id: polygon.id,
        points: polygon.points = pointsWithAngles.map((item) => item.p)
    });
    // Update the polygon points in place
    return {
        uuid: polygon.uuid,
        id: polygon.id,
        points: polygon.points = pointsWithAngles.map((item) => item.p)
    };
}

/**
 * Orders polygons from S1 to C2 and assigns names from a provided array.
 */
export function orderAndName(
    polygons: Polygon[]
): Polygon[] {
    if(polygons.length == 1) {
        const poly = polygons[0];
        poly.id = "";

        return [poly];
    }

    // Calculate centers for all polygons
    const centers = polygons.map(p => getPolygonCenter(p));

    // Get the sequence of indices
    const sequence = solveGreedyTSP(centers);

    // Reorder and assign names
    const orderedPolygons = sequence.map((originalIdx, orderIdx) => {
        let poly = polygons[originalIdx];

        poly = (orderIdx == 0) ? getOrderedReferencePoints(poly, polygons[sequence[orderIdx + 1]], "up"): getOrderedReferencePoints(poly, polygons[sequence[orderIdx - 1]], "down");
        
        // Assign name from the specific array if available
        if (vertebraeNames[orderIdx]) {
            poly.id = vertebraeNames[orderIdx];
        }
        
        return poly;
    });

    return orderedPolygons;
}