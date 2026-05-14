import type { Segment, Spine, Vertebrae } from "$lib/features/medical-parameters/parameters.type";
import { createDicomBitmap } from "$lib/features/dicom/bitmap";
import type { Polygon } from "$lib/shared/geometry/geometry.type";
import type { DicomImageMetadata, DicomImagePixelData, Series } from "$lib/features/dicom/types";

export class ProjectionState {
    series = $state<Series>(
        {
            
        }
    );

    imageMeta = $state<DicomImageMetadata>(
        {
            sopInstanceUID: "",
            rows: 0,
            cols: 0,
            slope: 0,
            intercept: 0,
            windowCenter: 0,
            windowWidth: 0,
            isSigned: false,
            mmPerPixel: 1
        }
    );
    
    projection: "side" | "frontal" = "side"

    bitmap = $state<ImageBitmap | null>(null);
    polygons = $state<Polygon[]>([]);

    structural = $derived.by(() => {
        const polygons = this.polygons;

        const vertebrae: Vertebrae[] = polygons.map((p: Polygon) => ({ name: p.id, shape: p }));
        const gaps = [];
        for (let i = 0; i < vertebrae.length - 1; i++) {
            gaps.push({ name: `${vertebrae[i+1].name}-${vertebrae[i].name}`, top: vertebrae[i+1], bottom: vertebrae[i] });
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

    constructor(projection: "side" | "frontal") {
        this.projection = projection;
    }

    setPixelDataAsBitmap(pixelData: DicomImagePixelData, meta: DicomImageMetadata) {
        createDicomBitmap(pixelData, meta).then(
            (image: ImageBitmap) => {
                this.bitmap = image;

                this.refresh();
            }
        );
    };

    refresh() {
        this.polygons = [];
    }
};