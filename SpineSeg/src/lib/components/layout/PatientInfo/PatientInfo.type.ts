import { supportedLocales } from "$lib/core/i18n/index.svelte";

type InfoSubBlock = {
    icon: string,
    alt: string,
    title: Record<typeof supportedLocales[number], string>,
    comment: string
}

type PatientInfoBlock = {
    title: Record<typeof supportedLocales[number], string>,
    icon: string,
    alt: string,
    subBlocks: InfoSubBlock[]
}

export type { PatientInfoBlock, InfoSubBlock };