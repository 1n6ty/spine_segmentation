import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Segment } from '../types';

const UP: Point = { x: 0, y: -1 };

export const getSegmentParams = (projection: Projection, segment: Segment, mmPerPixel: number) => {
    const points: Point[] = [];
    segment.forEach(v => {
        v.points.forEach(p => {
            points.push(p);
        });
    });

    const abc = M.solveCircleFit(points);
    const radius = 0.5 * Math.sqrt(Math.max(0, abc[1]**2 + abc[2]**2 - 4*abc[0]));
    const center: Point = { x: -abc[1] / 2, y: -abc[2] / 2 };

    const start = M.getMidpoint(segment[0].points[0], segment[0].points[3]);
    const end = M.getMidpoint(segment[segment.length - 1].points[1], segment[segment.length-1].points[2]);
    const chord = Math.min(M.distance(start, end), 2 * radius);

    // Signed central angle: the swept angle from the chord's start to its end around the
    // actual fitted center (not the unsigned law-of-cosines acos, which discards which side
    // of the chord the arc bulges toward). Negative = bulges left, positive = bulges right —
    // matching the clinical documents' "negative = clockwise from vertical" convention, and
    // necessary for scoliosis/lordosis-direction grading (see diagnosis/rules/frontal.ts and
    // sagittal.ts, which already branch on sign and were previously fed an always-positive value).
    const signedCentralAngle = M.toDegrees(M.getSignedAngle(M.vectorSub(start, center), M.vectorSub(end, center)));

    return {
        name: `${segment.at(-1)?.id}-${segment.at(0)?.id}`,
        params: {
            p1: { val: radius * mmPerPixel, type: "linear" },
            p2: { val: chord * mmPerPixel, type: "linear" },
            p3: { val: signedCentralAngle, type: "angular" },
            p4: { val: M.toDegrees(M.getSignedAngle(UP, M.vectorSub(end, start))), type: "angular" }
        }
    };
}