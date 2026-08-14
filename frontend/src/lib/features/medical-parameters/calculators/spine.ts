import type { Projection } from '$lib/features/dicom/types';
import * as M from '$lib/shared/geometry/geometry';
import type { Point } from '$lib/shared/geometry/geometry.type';
import type { Vertebrae } from '../types';

const UP: Point = { x: 0, y: -1 };

export const getSpineParams = (
	projection: Projection,
	vertebrae: Vertebrae[],
	mmPerPixel: number
) => {
	if (vertebrae.length < 24)
		return {
			name: 'overall',
			params: {
				p1: { val: null, type: 'angular' },
				p2: { val: null, type: 'linear' },
				p3: { val: null, type: 'linear' }
			}
		};

	const th1 = M.centroid(vertebrae.find((v) => v.id === 'Th1')!.points);
	const l5 = M.centroid(vertebrae.find((v) => v.id === 'L5')!.points);
	const angle = M.get_signed_angle(UP, M.vector_sub(th1, l5));

	return {
		name: 'overall',
		params: {
			p1: { val: M.to_degrees(angle), type: 'angular' },
			p2: { val: M.distance(th1, l5) * mmPerPixel, type: 'linear' },
			p3: { val: M.distance(th1, l5) * Math.sin(angle) * mmPerPixel, type: 'linear' }
		}
	};
};
