import type { Localized } from "./locale";

/**
 * Fixed anatomical regions, matched by vertebra id — not by array position —
 * so a region becomes available as soon as its own vertebrae are annotated,
 * independently of the other regions or the full 24-vertebra spine. Same
 * gating principle as the `measure` page's segments tab
 * (`medical-parameters/store.svelte.ts`'s `SEGMENT_ID_LISTS`), and the same
 * id lists (lumbar here is L1-S1, the clinically-standard "global lumbar
 * lordosis" range that includes the sacrum, matching the measure tab — not
 * L1-L5).
 */
export type RegionDef = {
    id: "cervical" | "thoracic" | "lumbar";
    ids: string[];
    label: Localized;
    vertebraeLabel: string;
};

export const REGIONS: RegionDef[] = [
    {
        id: "cervical",
        ids: ["C7", "C6", "C5", "C4", "C3", "C2"],
        label: { "ru-RU": "Шейный отдел", "en-US": "Cervical region" },
        vertebraeLabel: "C2-C7"
    },
    {
        id: "thoracic",
        ids: ["Th12", "Th11", "Th10", "Th9", "Th8", "Th7", "Th6", "Th5", "Th4", "Th3", "Th2", "Th1"],
        label: { "ru-RU": "Грудной отдел", "en-US": "Thoracic region" },
        vertebraeLabel: "Th1-Th12"
    },
    {
        id: "lumbar",
        ids: ["S1", "L5", "L4", "L3", "L2", "L1"],
        label: { "ru-RU": "Поясничный отдел", "en-US": "Lumbar region" },
        vertebraeLabel: "L1-S1"
    }
];
