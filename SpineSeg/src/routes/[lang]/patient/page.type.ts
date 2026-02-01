type InfoSubBlock = {
    icon: string,
    title: string,
    comment: string
}

type PatientInfoBlock = {
    title: string,
    icon: string,
    subBlocks: InfoSubBlock[]
}

export type {PatientInfoBlock};