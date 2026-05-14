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
        up = { uuid: "temp_up", id: "temp_up", points: nearestPoints };
        down = { uuid: "temp_down", id: "temp_down", points: otherPoints };
    } else {
        down = { uuid: "temp_down", id: "temp_down", points: nearestPoints };
        up = { uuid: "temp_up", id: "temp_up", points: otherPoints };
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
    return {
        uuid: polygon.uuid,
        id: polygon.id,
        points: angles.map(item => item.point)
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

        poly = (orderIdx == 0) ? getOrderedReferencePoints(poly, polygons[sequence[orderIdx + 1]], "down"): getOrderedReferencePoints(poly, polygons[sequence[orderIdx - 1]], "up");
        
        // Assign name from the specific array if available
        if (vertebraeNames[orderIdx]) {
            poly.id = vertebraeNames[orderIdx];
        }
        
        return poly;
    });

    return orderedPolygons;
}