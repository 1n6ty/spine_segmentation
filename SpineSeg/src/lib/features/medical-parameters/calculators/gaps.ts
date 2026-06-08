import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Gap } from '../types';

export const getGapParams = (projection: Projection, g: Gap, mmPerPixel: number) => {
    const v_top = M.vectorSub(g.top.points[1], g.top.points[0]);
    const v_bot = M.vectorSub(g.bottom.points[1], g.bottom.points[0]);
    const g01 = M.vectorSub(g.bottom.points[0], g.top.points[1]);
    const g21 = M.vectorSub(g.top.points[2], g.top.points[1]);
    const p5_val = (M.dotProduct(g01, g21)) / (M.distance(g.top.points[2], g.top.points[1]) + M.EPSILON);

    const name = `${g.top.id}-${g.bottom.id}`;

    if (projection == 'side') {
        return {
            name: name,
            params: {
                p1: { val: p5_val * mmPerPixel, type: "linear" },
                p2: { val: M.distance(g.top.points[1], g.bottom.points[0]) * mmPerPixel, type: "linear" },
                p3: { val: M.distance(g.top.points[2], g.bottom.points[3]) * mmPerPixel, type: "linear" },
                p4: { val: M.angleBetweenVectors(M.vectorSub(g.top.points[1], g.bottom.points[0]), M.vectorSub(g.top.points[2], g.bottom.points[3])), type: "angular" },
                p5: { val: M.angleBetweenVectors(v_top, v_bot), type: "angular" },
                p6: { val: M.angleBetweenVectors(g01, g21), type: "angular" },
                p7: { val: (g.top.id.includes("L5") && g.bottom.id.includes("S1")) ? M.angleBetweenVectors(M.vectorSub(g.bottom.points[1], g.bottom.points[0]), M.vectorSub(g.top.points[2], g.top.points[1])) : 0, type: "angular" }
            }
        };
    } else if (projection == 'frontal') {
        return {
            name: name,
            params: {
                p1: { val: p5_val * mmPerPixel, type: "linear" },
                p2: { val: M.distance(g.top.points[1], g.bottom.points[0]) * mmPerPixel, type: "linear" },
                p3: { val: M.distance(g.top.points[2], g.bottom.points[3]) * mmPerPixel, type: "linear" },
                p4: { val: M.angleBetweenVectors(M.vectorSub(g.top.points[1], g.bottom.points[0]), M.vectorSub(g.top.points[2], g.bottom.points[3])), type: "angular" },
                p5: { val: M.angleBetweenVectors(v_top, v_bot), type: "angular" },
                p6: { val: M.angleBetweenVectors(g01, g21), type: "angular" },
                p7: { val: (g.top.id.includes("L5") && g.bottom.id.includes("S1")) ? M.angleBetweenVectors(M.vectorSub(g.bottom.points[1], g.bottom.points[0]), M.vectorSub(g.top.points[2], g.top.points[1])) : 0, type: "angular" }
            }
        };
    }
}