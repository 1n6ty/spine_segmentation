import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Vertebrae } from '../types';

/**
 * Every angle here is signed via `get_signed_angle` (the same helper
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
	return {
		name: v.id,
		params: {
			p1: { 
				val: 
					v.id != 'C2'
						? M.distance(v.points[1], v.points[2]) * mmPerPixel
						: null,
				type: 'linear'
			},
			p2: { 
				val: 
					v.id != 'S1'
						? M.distance(v.points[0], v.points[3]) * mmPerPixel
						: null,
				type: 'linear'
			},
			p3: { 
				val: 
					v.id != 'S1' && v.id != 'C2'
						? M.distance(v.points[0], v.points[1]) * mmPerPixel
						: null,
				type: 'linear'
			},
			p4: { 
				val: 
					v.id != 'S1' && v.id != 'C2'
						? M.distance(v.points[2], v.points[3]) * mmPerPixel
						: null,
				type: 'linear'
			},
			p5: {
				val:
					v.id != 'S1' && v.id != 'C2'
						? M.to_degrees(
							M.get_signed_angle(
								M.vector_sub(v.points[2], v.points[3]),
								M.vector_sub(v.points[1], v.points[0])
							)
						)
						: null,
				type: 'angular'
			},
			p6: {
				val: 
					v.id != 'S1' && v.id != 'C2'
						? M.to_degrees(M.get_signed_angle(UP, M.vector_sub(v.points[1], v.points[0])))
						: null,
				type: 'angular'
			},
			p7: {
				val: 
					v.id != 'C2'
						? M.to_degrees(M.get_signed_angle(UP, M.vector_sub(v.points[2], v.points[1])))
						: null,
				type: 'angular'
			},
			p8: {
				val: 
					v.id != 'S1'
						? M.to_degrees(M.get_signed_angle(UP, M.vector_sub(v.points[3], v.points[0])))
						: null,
				type: 'angular'
			},
			p9: {
				val:
					v.id === 'S1'
						? M.to_degrees(M.get_signed_angle(RIGHT, M.vector_sub(v.points[2], v.points[1])))
						: null,
				type: 'angular'
			}
		}
	};
};
