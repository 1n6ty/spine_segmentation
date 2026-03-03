type ProjectionType = "side" | "frontal";

type UploadBtnType = {
    lable: string,
    btn: string,
    id: string,
    callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) => void
};

export type { UploadBtnType };