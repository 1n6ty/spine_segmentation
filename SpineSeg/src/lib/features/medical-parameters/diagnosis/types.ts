import type { Localized } from "../locale";

export type { LocaleKey, Localized } from "../locale";

export type Severity = "normal" | "grade1" | "grade2" | "grade3" | "grade4" | "grade5";

export type Finding = {
    id: string;
    severity: Severity;
    text: Localized;
};

export type VertebraDiagnosis = {
    id: string;
    findings: Finding[];
    /** Precomputed human-readable sentence listing every geometric parameter
     * for this vertebra — see diagnosis/narrative.ts. The verdict is conveyed
     * separately, by `findings`' own cards. */
    narrative: Localized;
};

export type GapDiagnosis = {
    id: string;
    findings: Finding[];
    narrative: Localized;
};

export type RegionDiagnosis = {
    id: string;
    label: Localized;
    vertebraeLabel: string;
    vertebras: VertebraDiagnosis[];
    gaps: GapDiagnosis[];
    findings: Finding[];
    narrative: Localized;
};

export type ProjectionDiagnosis = {
    insufficientAnnotation: boolean;
    regions: RegionDiagnosis[];
    /** Whole-spine findings that aren't tied to a single region, e.g. GCoM lateral balance. */
    overall: Finding[];
    conclusion: Finding[];
};
