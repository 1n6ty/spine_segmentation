import { getDistance, getPolygonCenter } from "$lib/utils/geometry/geometry";
import type { Point, Polygon } from "$lib/utils/geometry/geometry.type";

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

/**
 * Orders polygons from S1 to C2 and assigns names from a provided array.
 */
export function orderAndNameVertebrae(
    polygons: Polygon[]
): Polygon[] {
    // Calculate centers for all polygons
    const centers = polygons.map(p => getPolygonCenter(p));

    // Get the sequence of indices
    const sequence = solveGreedyTSP(centers);

    // Reorder and assign names
    const orderedPolygons = sequence.map((originalIdx, orderIdx) => {
        const poly = polygons[originalIdx];
        
        // Assign name from the specific array if available
        if (vertebraeNames[orderIdx]) {
            poly.id = vertebraeNames[orderIdx];
        }
        
        return poly;
    });

    return orderedPolygons;
}