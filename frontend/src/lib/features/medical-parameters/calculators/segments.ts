import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import { solveCircleFit } from '$lib/shared/geometry/circle-fit';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Segment } from '../types';

const UP: Point = { x: 0, y: -1 };

export const getSegmentParams = (projection: Projection, segment: Segment, mmPerPixel: number) => {
	const points: Point[] = [];
	segment.forEach((v) => {
		v.points.forEach((p) => {
			points.push(p);
		});
	});

	if (points.length < 3) {
		return {
			name: `${segment.at(-1)?.id}-${segment.at(0)?.id}`,
			params: {
				p1: { val: null, type: 'linear' },
				p2: { val: null, type: 'linear' },
				p3: { val: null, type: 'angular' },
				p4: { val: null, type: 'angular' }
			}
		};
	}

	const abc = solveCircleFit(points);
	const radius = M.get_arc_radius(abc);
	const center = M.get_arc_center(abc);

	const start = M.get_midpoint(segment[0].points[0], segment[0].points[3]);
	const end = M.get_midpoint(
		segment[segment.length - 1].points[1],
		segment[segment.length - 1].points[2]
	);
	const chord = Math.min(M.distance(start, end), 2 * radius);

	// Signed central angle: the swept angle from the chord's start to its end around the
	// actual fitted center (not the unsigned law-of-cosines acos, which discards which side
	// of the chord the arc bulges toward). Negative = bulges left, positive = bulges right —
	// matching the clinical documents' "negative = clockwise from vertical" convention, and
	// necessary for scoliosis/lordosis-direction grading (see diagnosis/rules/frontal.ts and
	// sagittal.ts, which already branch on sign and were previously fed an always-positive value).
	const signedCentralAngle = M.to_degrees(
		M.get_signed_angle(M.vector_sub(start, center), M.vector_sub(end, center))
	);

	return {
		name: `${segment.at(-1)?.id}-${segment.at(0)?.id}`,
		params: {
			p1: { val: radius * mmPerPixel, type: 'linear' },
			p2: { val: chord * mmPerPixel, type: 'linear' },
			p3: { val: signedCentralAngle, type: 'angular' },
			p4: { val: M.to_degrees(M.get_signed_angle(UP, M.vector_sub(end, start))), type: 'angular' }
		}
	};
};
