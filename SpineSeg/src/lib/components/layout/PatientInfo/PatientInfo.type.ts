type InfoSubBlock = {
    icon: string,
    alt: string,
    title: Record<string, string> & { en: string },
    comment: string
}

type PatientInfoBlock = {
    title: Record<string, string> & { en: string },
    icon: string,
    alt: string,
    subBlocks: InfoSubBlock[]
}

export type { PatientInfoBlock, InfoSubBlock };