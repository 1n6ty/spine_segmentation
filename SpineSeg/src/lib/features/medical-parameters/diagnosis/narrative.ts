import type { Localized } from "../locale";
import { parametersNames } from "../config";
import type { Projection } from "$lib/features/dicom/types";

type StructureType = keyof (typeof parametersNames)["side"]["en-US"];
type ParamEntry = { val: number | string | null; type: string };

/** Bilingual label for a calculator parameter (e.g. segments p3 -> "Arc central angle"/"Центральный угол дуги"). */
export function paramLabel(projection: Projection, structureType: StructureType, key: string): Localized {
    const ru = parametersNames[projection]["ru-RU"][structureType] as Record<string, { name: string }>;
    const en = parametersNames[projection]["en-US"][structureType] as Record<string, { name: string }>;
    return { "ru-RU": ru[key].name, "en-US": en[key].name };
}

export function vertebraLabel(id: string): Localized {
    return { "ru-RU": `Позвонок ${id}`, "en-US": `Vertebra ${id}` };
}

export function gapLabel(id: string): Localized {
    return { "ru-RU": `Диск ${id}`, "en-US": `Disc ${id}` };
}

// No space before "°" (degree symbol attaches directly), a space before "мм"/"mm"
// — matches the existing convention in rules/sagittal.ts and frontal.ts.
function unitFor(type: string): Localized {
    return type === "angular" ? { "ru-RU": "°", "en-US": "°" } : { "ru-RU": " мм", "en-US": " mm" };
}

/**
 * Builds the human-readable sentence listing every geometric parameter for a
 * region/vertebra/gap — not just the ones a grading rule happened to flag.
 * The qualitative verdict (normal or not) is conveyed separately by the
 * existing severity cards rendered right after this narrative, not folded
 * into the sentence itself.
 *
 * Parameters with a null value (e.g. p9 on a non-S1 vertebra, p7 on a non-
 * L5/S1 gap) are skipped — there's nothing measured to report for them.
 */
export function buildParametersNarrative(
    identity: Localized,
    projection: Projection,
    structureType: StructureType,
    params: Record<string, ParamEntry>
): Localized {
    const clauses: Localized[] = [];
    for (const key of Object.keys(params)) {
        const entry = params[key];
        if (typeof entry.val !== "number") continue;
        const label = paramLabel(projection, structureType, key);
        const unit = unitFor(entry.type);
        clauses.push({
            "ru-RU": `${label["ru-RU"]} составляет ${entry.val.toFixed(1)}${unit["ru-RU"]}`,
            "en-US": `${label["en-US"]} is ${entry.val.toFixed(1)}${unit["en-US"]}`
        });
    }

    const joined: Localized = {
        "ru-RU": clauses.map((c) => c["ru-RU"]).join(", "),
        "en-US": clauses.map((c) => c["en-US"]).join(", ")
    };

    return {
        "ru-RU": `${identity["ru-RU"]}: ${joined["ru-RU"]}.`,
        "en-US": `${identity["en-US"]}: ${joined["en-US"]}.`
    };
}
