import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Vertebrae } from '../types';

const UP: Point = { x: 0, y: -1 };

export const  getSpineParams = (projection: Projection, vertebras: Vertebrae[], mmPerPixel: number) => {
    if (vertebras.length < 24) return {
        name: "overall",
        params: {
            p1: { val: null, type: "angular" }, p2: { val: null, type: "linear" }, p3: { val: null, type: "linear" }
        }
    };

    const th1 = M.getPolygonCenter(vertebras[17]);
    const l5 = M.getPolygonCenter(vertebras[1]);
    const angle = M.getSignedAngle(UP, M.vectorSub(th1, l5));

    return {
        name: "overall",
        params: {
            p1: { val: M.toDegrees(angle), type: "angular" },
            p2: { val: M.distance(th1, l5) * mmPerPixel, type: "linear" },
            p3: { val: M.distance(th1, l5) * Math.sin(angle) * mmPerPixel, type: "linear" }
        }
    };
}
