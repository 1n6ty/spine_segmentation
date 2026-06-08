import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Segment } from '../types';

export const getSegmentParams = (projection: Projection, segment: Segment, mmPerPixel: number) => {
    const points: Point[] = [];
    segment.forEach(v => {
        v.points.forEach(p => {
            points.push(p);
        });
    });

    const abc = M.solveCircleFit(points);
    const radius = 0.5 * Math.sqrt(Math.max(0, abc[1]**2 + abc[2]**2 - 4*abc[0]));
    
    const start = M.getMidpoint(segment[0].points[0], segment[0].points[3]);
    const end = M.getMidpoint(segment[segment.length - 1].points[1], segment[segment.length-1].points[2]);
    const chord = Math.min(M.distance(start, end), 2 * radius);

    return {
        name: `${segment.at(-1)?.id}-${segment.at(0)?.id}`,
        params: {
            p1: { val: radius * mmPerPixel, type: "linear" },
            p2: { val: chord * mmPerPixel, type: "linear" },
            p3: { val: M.toDegrees(Math.acos((2*radius**2 - chord**2) / (2*radius**2 + M.EPSILON))), type: "angular" },
            p4: { val: M.toDegrees(Math.atan2(start.y - end.y, start.x - end.x)), type: "angular" }
        }
    };
}