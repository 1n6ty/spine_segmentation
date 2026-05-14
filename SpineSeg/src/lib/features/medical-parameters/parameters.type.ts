import type { Polygon } from "$lib/shared/geometry/geometry.type";

export interface Vertebrae {
    name: string;
    shape: Polygon;
}

export interface Gap {
    name: string;
    top: Vertebrae;
    bottom: Vertebrae;
}

export interface Spine {
    name: string;
    vertebrae: Vertebrae[];
}

export interface Segment {
    name: string;
    vertebrae: Vertebrae[];
}