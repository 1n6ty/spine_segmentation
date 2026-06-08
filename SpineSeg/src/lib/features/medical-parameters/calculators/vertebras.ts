import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Vertebrae } from '../types';

export const getVertebraeParams = (projection: Projection, v: Vertebrae, mmPerPixel: number) => {
    if(projection == 'side'){
        return {
            name: v.id,
            params: {
                p1: { val: M.distance(v.points[1], v.points[2]) * mmPerPixel, type: "linear" },
                p2: { val: M.distance(v.points[0], v.points[3]) * mmPerPixel, type: "linear" },
                p3: { val: M.distance(v.points[0], v.points[1]) * mmPerPixel, type: "linear" },
                p4: { val: M.distance(v.points[2], v.points[3]) * mmPerPixel, type: "linear" },
                p5: { 
                    name: v.id,
                    val: M.angleBetweenVectors(
                        M.vectorSub(v.points[1], v.points[0]),
                        M.vectorSub(v.points[2], v.points[3])
                    ), 
                    type: "angular" 
                },
                p6: { val: M.toDegrees(Math.atan2(v.points[0].x - v.points[1].x, v.points[1].y - v.points[0].y)), type: "angular" },
                p7: { val: M.toDegrees(Math.atan2(v.points[1].x - v.points[2].x, v.points[1].y - v.points[2].y)), type: "angular" },
                p8: { val: M.toDegrees(Math.atan2(v.points[0].x - v.points[3].x, v.points[0].y - v.points[3].y)), type: "angular" },
                p9: { val: v.id === "S1" ? M.toDegrees(Math.asin((v.points[2].y - v.points[1].y) / (M.distance(v.points[1], v.points[2]) + M.EPSILON))) : null, type: "angular" }
            }
        }
    } else if (projection == 'frontal') {
        return {
            name: v.id,
            params: {
                p1: { val: M.distance(v.points[1], v.points[2]) * mmPerPixel, type: "linear" },
                p2: { val: M.distance(v.points[0], v.points[3]) * mmPerPixel, type: "linear" },
                p3: { val: M.distance(v.points[2], v.points[3]) * mmPerPixel, type: "linear" },
                p4: { val: M.distance(v.points[1], v.points[0]) * mmPerPixel, type: "linear" },
                p5: { val: M.distance(M.getMidpoint(v.points[1], v.points[2]), M.getMidpoint(v.points[0], v.points[3])) * mmPerPixel, type: "linear" },
                p6: { val: M.angleBetweenVectors(M.vectorSub(v.points[1], v.points[0]), M.vectorSub(v.points[2], v.points[3])), type: "angular" },
                p7: { val: M.toDegrees(Math.atan2(M.getMidpoint(v.points[1], v.points[2]).x - M.getMidpoint(v.points[0], v.points[3]).x, M.getMidpoint(v.points[1], v.points[2]).y - M.getMidpoint(v.points[0], v.points[3]).y)), type: "angular" },
                p8: { val: M.toDegrees(Math.atan2(v.points[1].x - v.points[2].x, v.points[1].y - v.points[2].y)), type: "angular" },
                p9: { val: M.toDegrees(Math.atan2(v.points[0].x - v.points[3].x, v.points[0].y - v.points[3].y)), type: "angular" }
            }
        };
    }
}