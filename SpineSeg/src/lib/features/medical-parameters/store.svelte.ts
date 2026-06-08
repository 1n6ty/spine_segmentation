import { project } from "$lib/core/project.svelte";
import { getGapParams } from "./calculators/gaps";
import { getSegmentParams } from "./calculators/segments";
import { getSpineParams } from "./calculators/spine";
import { getVertebraeParams } from "./calculators/vertebras";
import type { Segment } from "./types";


let sideSegments = $state<Segment[]>([]);
let frontalSegments = $state<Segment[]>([]);

export const structures = {
    side: {
        get vertebras() {
            return project.session.projections.side.polygons;
        },
        get gaps() {
            const polygons = project.session.projections.side.polygons;
            return polygons.slice(0, -1).map((v, i) => ({
                top: polygons[i + 1],
                bottom: v
            }));
        },
        get segments() { return sideSegments; },
        set segments(value) { sideSegments = value; }
    },
    frontal: {
        get vertebras() {
            return project.session.projections.frontal.polygons;
        },
        get gaps() {
            const polygons = project.session.projections.frontal.polygons;
            return polygons.slice(0, -1).map((v, i) => ({
                top: polygons[i + 1],
                bottom: v
            }));
        },
        get segments() { return frontalSegments; },
        set segments(value) { frontalSegments = value; }
    }
};

export const params = $state({
    activeStructure: 'vertebras',

    get side() {
        return this.calculate('side')
    },

    get frontal() {
        return this.calculate('frontal')
    },

    calculate(projection: 'side' | 'frontal') {
        const proj = project.session.projections[projection];
        const mm = proj.patient?.study.series.sopInstance.mmPerPixel || 1;

        return {
            vertebras: structures[projection].vertebras.map(v => getVertebraeParams(projection, v, mm)),
            gaps: structures[projection].gaps.map(g => getGapParams(projection, g, mm)),
            segments: structures[projection].segments.map(s => getSegmentParams(projection, s, mm)),
            overall: getSpineParams(projection, structures[projection].vertebras, mm)
        };
    }
});