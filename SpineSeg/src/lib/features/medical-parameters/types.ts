import type { Polygon } from "$lib/shared/geometry/geometry.type";

export type supportedStructures = "vertebras" | "gaps" | "segments" | "overall";

export type ParametersType = "linear" | "angular";

export type Vertebrae = Polygon;
export type Gap = {
    top: Vertebrae,
    bottom: Vertebrae
}
export type Segment = Polygon[];