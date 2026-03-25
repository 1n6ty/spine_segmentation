import type { Polygon } from "$lib/utils/geometry/geometry.type";

export interface SpineElement {
    name: string;
    shape: Polygon;
}

export interface Vertebrae extends SpineElement {}

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