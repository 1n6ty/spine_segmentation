import type { Polygon } from '$lib/shared/geometry/geometry.type';

export type supportedStructures = 'vertebrae' | 'gaps' | 'segments' | 'overall';

export type Vertebrae = Polygon;
export type Gap = {
	top: Vertebrae;
	bottom: Vertebrae;
};
export type Segment = Polygon[];
