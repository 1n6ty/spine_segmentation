import type { Localized } from "./locale";

/**
 * Fixed anatomical regions, sliced against the vertebra ordering guaranteed by
 * `features/editor/logic/orderer.ts` (orderAndName): polygons[0] is always S1,
 * ascending to polygons[23] = C2, whenever all 24 vertebrae are annotated.
 *
 * Shared between the `measure` page's hardcoded "segments" tab and the
 * `diagnosis` rule engine (`diagnosis/store.svelte.ts`) — anatomical regions
 * aren't a diagnosis-specific concept.
 */
export type RegionDef = {
    id: "cervical" | "thoracic" | "lumbar";
    slice: [number, number];
    label: Localized;
    vertebraeLabel: string;
};

export const TOTAL_VERTEBRAE = 24;

export const REGIONS: RegionDef[] = [
    {
        id: "cervical",
        slice: [18, 24],
        label: { "ru-RU": "Шейный отдел", "en-US": "Cervical region" },
        vertebraeLabel: "C2-C7"
    },
    {
        id: "thoracic",
        slice: [6, 18],
        label: { "ru-RU": "Грудной отдел", "en-US": "Thoracic region" },
        vertebraeLabel: "Th1-Th12"
    },
    {
        id: "lumbar",
        slice: [1, 6],
        label: { "ru-RU": "Поясничный отдел", "en-US": "Lumbar region" },
        vertebraeLabel: "L1-L5"
    }
];

/** Index of S1, the sacrum, handled separately from the three regions above (sacral slope, L5-S1 angle). */
export const S1_INDEX = 0;
