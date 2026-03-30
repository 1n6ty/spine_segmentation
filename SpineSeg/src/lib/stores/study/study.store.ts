import { writable, derived, type Readable } from "svelte/store";
import type { ProjectionPolygonsStore } from "./study.type";
import type { Gap, Segment, Spine, Vertebrae } from "$lib/features/medicalParameters/parameters.type";

const frontalPolygonsStore = writable<ProjectionPolygonsStore>([]);
const sidePolygonsStore = writable<ProjectionPolygonsStore>([]);

const autoPolygons = writable<{ side: ProjectionPolygonsStore, frontal: ProjectionPolygonsStore }>({ side: [], frontal: [] });

export interface StructuralElements {
    vertebrae: Vertebrae[];
    gaps: Gap[];
    segments: Segment[];
    spine: Spine;
}

function createStructuralStore(polygonStore: Readable<ProjectionPolygonsStore>): Readable<StructuralElements> {
    return derived(polygonStore, ($polygons) => {
        const vertebrae: Vertebrae[] = $polygons.map((poly, index) => ({
            name: poly.id,
            shape: poly
        }));

        const gaps: Gap[] = [];
        for (let i = 0; i < vertebrae.length - 1; i++) {
            const top = vertebrae[i + 1];
            const bottom = vertebrae[i];
            gaps.push({
                name: `${top.name}-${bottom.name}`,
                top,
                bottom
            });
        }

        const formatSegmentName = (vs: Vertebrae[]) => {
            if (vs.length < 2) return '';
            return `${vs[0].name}-${vs[vs.length - 1].name}`;
        };

        const getSegment = (prefix: string) => { 
            const vs = vertebrae.filter(v => v.name.startsWith(prefix));
            return { 
                name: formatSegmentName(vs), 
                vertebrae: vs 
            };
        }

        const getSegmentWithS1 = (prefix: string) => {
            const vs = vertebrae.filter(v => v.name.startsWith("S") || v.name.startsWith(prefix));
            return { 
                name: formatSegmentName(vs.reverse()), 
                vertebrae: vs 
            };
        }

        const segments: Segment[] = [
            { prefix: "L", method: getSegmentWithS1 },
            { prefix: "Th", method: getSegment },
            { prefix: "C", method: getSegment }
        ]
        .map(({ prefix, method }) => method(prefix))
        .filter(s => s.vertebrae.length > 1 && s.name !== '');

        const spine: Spine = {
            name: "Overall",
            vertebrae: vertebrae
        };

        return { vertebrae, gaps, segments, spine };
    });
}

const frontalStructureStore = createStructuralStore(frontalPolygonsStore);
const sideStructureStore = createStructuralStore(sidePolygonsStore);

export { sidePolygonsStore, frontalPolygonsStore, sideStructureStore, frontalStructureStore, autoPolygons };