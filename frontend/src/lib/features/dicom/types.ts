export type Projection = 'side' | 'frontal';

// Mirrors backend/Mainland/Dicom/management/commands/create_xray_file_roles_if_not_exists.py's
// seeded FileRole slugs -- each capped at max_count=1 per Study, enforced server-side.
// Shared between the base upload flow (session.svelte.ts) and the Autofill status flow
// (features/autofill/autofill.ts), both of which need to know which FileRole a projection
// slot maps to.
export const PROJECTION_TO_FILE_ROLE_SLUG: Record<Projection, string> = {
	side: 'DICOM_XRAY_SAGITTAL',
	frontal: 'DICOM_XRAY_FRONTAL'
};

export type Patient = {
	patientUID: string;

	name: string | null;
	birthDate: Date | null;
	sex: string | null;
};

export type Study = {
	studyUID: string;

	studyDate: Date | null;
	description: string | null;
	institutionName: string | null;
	institutionAddress: string | null;
	stationName: string | null;
	physicianName: string | null;
};

export type Series = {
	seriesUID: string;

	modality: string | null;
	bodyPart: string | null;
};

export type DicomImageMetadata = {
	sopInstanceUID: string;

	rows: number;
	cols: number;
	slope: number;
	intercept: number;
	windowCenter: number;
	windowWidth: number;
	isSigned: boolean;
	mmPerPixel: number;
};

export type DicomImagePixelData = Int16Array | Uint16Array | Uint8Array | null;
