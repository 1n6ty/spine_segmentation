import type { getGapSagittalParams, getGapFrontalParams } from "$lib/features/medicalParameters/gaps";
import type { getSegmentSagittalParams, getSegmentFrontalParams } from "$lib/features/medicalParameters/segments";
import type { getSpineSagittalParams, getSpineFrontalParams } from "$lib/features/medicalParameters/spine";
import type { getVertebraFrontalParams, getVertebraSagittalParams } from "$lib/features/medicalParameters/vertebraes";

export type ParametersType = "linear" | "angular";

export type ParametersListType = {
    side: {
        vertebra: {
            pl: ReturnType<typeof getVertebraSagittalParams>[],
            ru: Record<keyof ReturnType<typeof getVertebraSagittalParams>['params'], { name: string, type: ParametersType }>,
            en: Record<keyof ReturnType<typeof getVertebraSagittalParams>['params'], { name: string, type: ParametersType }>
        },
        disk: {
            pl: ReturnType<typeof getGapSagittalParams>[],
            ru: Record<keyof ReturnType<typeof getGapSagittalParams>['params'], { name: string, type: ParametersType }>,
            en: Record<keyof ReturnType<typeof getGapSagittalParams>['params'], { name: string, type: ParametersType }>
        },
        part: {
            pl: ReturnType<typeof getSegmentSagittalParams>[],
            ru: Record<keyof ReturnType<typeof getSegmentSagittalParams>['params'], { name: string, type: ParametersType }>,
            en: Record<keyof ReturnType<typeof getSegmentSagittalParams>['params'], { name: string, type: ParametersType }>
        },
        overall: {
            pl: ReturnType<typeof getSpineSagittalParams>[],
            ru: Record<keyof ReturnType<typeof getSpineSagittalParams>['params'], { name: string, type: ParametersType }>,
            en: Record<keyof ReturnType<typeof getSpineSagittalParams>['params'], { name: string, type: ParametersType }>
        }
    },
    frontal: {
        vertebra: {
            pl: ReturnType<typeof getVertebraFrontalParams>[],
            ru: Record<keyof ReturnType<typeof getVertebraFrontalParams>['params'], { name: string, type: ParametersType }>,
            en: Record<keyof ReturnType<typeof getVertebraFrontalParams>['params'], { name: string, type: ParametersType }>
        },
        disk: {
            pl: ReturnType<typeof getGapFrontalParams>[],
            ru: Record<keyof ReturnType<typeof getGapFrontalParams>['params'], { name: string, type: ParametersType }>,
            en: Record<keyof ReturnType<typeof getGapFrontalParams>['params'], { name: string, type: ParametersType }>
        },
        part: {
            pl: ReturnType<typeof getSegmentFrontalParams>[],
            ru: Record<keyof ReturnType<typeof getSegmentFrontalParams>['params'], { name: string, type: ParametersType }>,
            en: Record<keyof ReturnType<typeof getSegmentFrontalParams>['params'], { name: string, type: ParametersType }>
        },
        overall: {
            pl: ReturnType<typeof getSpineFrontalParams>[],
            ru: Record<keyof ReturnType<typeof getSpineFrontalParams>['params'], { name: string, type: ParametersType }>,
            en: Record<keyof ReturnType<typeof getSpineFrontalParams>['params'], { name: string, type: ParametersType }>
        }
    }
};
