import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Vertebrae } from '../types';

/**
 * Every angle here is signed via `getSignedAngle` (the same helper
 * `editor/logic/orderer.ts` relies on for point ordering), following standard
 * mathematical convention: positive for counter-clockwise rotation, negative
 * for clockwise — matching the clinical source documents' own stated
 * convention ("Знак (-) отражает угол отклонение прямой от вертикали по
 * часовой стрелке" — negative = clockwise from vertical).
 *
 * Inclination angles (p6-p9 / p7-p9) measure rotation from a named reference
 * axis (0° = aligned with it). Wedging angles (p5 side / p6 frontal) measure
 * rotation between the vertebra's two side edges, ordered so a taller right
 * (frontal) or posterior (side) edge reads positive — verified against the
 * frontal-plane document's explicit "base right = positive, base left =
 * negative" wedging convention; the side/sagittal equivalent has no separate
 * explicit sign table in the source, so the same ordering pattern is applied
 * for consistency.
 */
const UP: Point = { x: 0, y: -1 };
const RIGHT: Point = { x: 1, y: 0 };

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
                    val: M.toDegrees(M.getSignedAngle(
                        M.vectorSub(v.points[2], v.points[3]),
                        M.vectorSub(v.points[1], v.points[0])
                    )),
                    type: "angular"
                },
                p6: { val: M.toDegrees(M.getSignedAngle(UP, M.vectorSub(v.points[1], v.points[0]))), type: "angular" },
                p7: { val: M.toDegrees(M.getSignedAngle(UP, M.vectorSub(v.points[2], v.points[1]))), type: "angular" },
                p8: { val: M.toDegrees(M.getSignedAngle(UP, M.vectorSub(v.points[3], v.points[0]))), type: "angular" },
                p9: { val: v.id === "S1" ? M.toDegrees(M.getSignedAngle(RIGHT, M.vectorSub(v.points[2], v.points[1]))) : null, type: "angular" }
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
                p6: { val: M.toDegrees(M.getSignedAngle(M.vectorSub(v.points[2], v.points[3]), M.vectorSub(v.points[1], v.points[0]))), type: "angular" },
                p7: { val: M.toDegrees(M.getSignedAngle(UP, M.vectorSub(M.getMidpoint(v.points[1], v.points[2]), M.getMidpoint(v.points[0], v.points[3])))), type: "angular" },
                p8: { val: M.toDegrees(M.getSignedAngle(UP, M.vectorSub(v.points[2], v.points[1]))), type: "angular" },
                p9: { val: M.toDegrees(M.getSignedAngle(UP, M.vectorSub(v.points[3], v.points[0]))), type: "angular" }
            }
        };
    }
}
