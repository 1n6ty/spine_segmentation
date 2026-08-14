import type { Projection } from '$lib/features/dicom/types';

type UploadBtnType = {
	label: string;
	projection: Projection;
	accepted: string;
	acceptedComment: string;
	btn: string;
	id: string;
	callback: (e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => void;
};

export type { UploadBtnType };
