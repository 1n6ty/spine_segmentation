import type { Polygon } from "$lib/shared/geometry/geometry.type";
import type { ProjectionState } from "./projection.svelte";

type segmentationProcessStatus = "sending" | "segmenting" | "revealing" | "postprocessing" | "done";

export class AutoSegmentationService {

    status = $state<segmentationProcessStatus | null>(null);
    receivedPolygons: Polygon[] | null = null

    constructor(private projectionState: ProjectionState) {}

    requestSegmentation() {
        this.projectionState.
    }
};