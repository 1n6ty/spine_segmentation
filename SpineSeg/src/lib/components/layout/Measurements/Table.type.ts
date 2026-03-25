type TableContentType = {
    head: {
        name: string;
        type: "linear" | "angular";
    }[],
    rows: string[][]
};

type TableStructures = "vertebra" | "disk" | "part" | "overall";

export type { TableContentType, TableStructures };