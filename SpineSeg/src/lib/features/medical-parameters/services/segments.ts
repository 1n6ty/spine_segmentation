import type { Projection } from "$lib/features/dicom/types";
import { structures } from "../store.svelte";
import type { Vertebrae } from "../types";

export const addSegment = (projection: Projection, vertebras: Vertebrae[]) => {
    structures[projection].segments.push(vertebras);
}

export const removeSegment = (projection: Projection, index: number) => {
    structures[projection].segments.splice(index, 1);
}