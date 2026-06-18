import { project } from "$lib/core/project.svelte";
import { getGapParams } from "./calculators/gaps";
import { getSegmentParams } from "./calculators/segments";
import { getSpineParams } from "./calculators/spine";
import { getVertebraeParams } from "./calculators/vertebras";
import type { Segment, Vertebrae } from "./types";

/**
 * 3 standard segments shown on the `measure` page, gated INDEPENDENTLY of each
 * other and of the full 24-vertebra spine: each one appears as soon as its own
 * vertebrae are present, by matching `id` (not array position/index).
 *
 * Deliberately separate from `regions.ts` (used by the report's diagnosis
 * engine, which requires the full spine and special-cases S1 on its own) —
 * these two consumers have different requirements:
 *  - Lumbar here is L1-S1 (includes the sacrum, the clinically standard
 *    "global lumbar lordosis" range), whereas `regions.ts`'s lumbar region is
 *    L1-L5 with S1 handled separately (sacral slope, spondylolisthesis).
 *  - These segments need only their own ids present; `regions.ts` requires all
 *    24 vertebrae before any region is considered valid.
 *
 * Caveat: this relies on `editor/logic/orderer.ts`'s naming being correct,
 * which itself assumes vertebrae are annotated contiguously from S1 upward.
 * Annotating an isolated region with nothing below it (e.g. only cervical,
 * with no thoracic/lumbar/sacral vertebrae at all) will mis-name the
 * bottommost one "S1" rather than recognizing it as cervical — a limitation
 * of the naming algorithm itself, not of this gating logic.
 */
const SEGMENT_ID_LISTS: string[][] = [
    ["C7", "C6", "C5", "C4", "C3", "C2"], // Cervical, C2-C7
    ["Th12", "Th11", "Th10", "Th9", "Th8", "Th7", "Th6", "Th5", "Th4", "Th3", "Th2", "Th1"], // Thoracic, Th1-Th12
    ["S1", "L5", "L4", "L3", "L2", "L1"] // Lumbar, L1-S1
];

function getSegmentByIds(polygons: Vertebrae[], ids: string[]): Vertebrae[] | null {
    const byId = new Map(polygons.map((p) => [p.id, p]));
    const matched = ids.map((id) => byId.get(id));
    if (matched.some((p) => !p)) return null;
    return matched as Vertebrae[];
}

function getFixedSegments(polygons: Vertebrae[]): Segment[] {
    return SEGMENT_ID_LISTS
        .map((ids) => getSegmentByIds(polygons, ids))
        .filter((s): s is Vertebrae[] => s !== null);
}

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
        get segments() {
            return getFixedSegments(project.session.projections.side.polygons);
        }
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
        get segments() {
            return getFixedSegments(project.session.projections.frontal.polygons);
        }
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
