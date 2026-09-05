import type { Projection } from '$lib/features/dicom/types';
import type { SegmentDefinition } from '$lib/features/medical-parameters/types';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

export type SessionProjection = {
	sopInstanceUid: string;
	polygons: Polygon[];
	segments: SegmentDefinition[];
};

// Mirrors backend/Mainland/Dicom/v1/schemas/user_recent_studies.py's
// UserRecentStudies_Ref_Schema -- the slim shape returned by the recent-studies
// list endpoint. No accountId/TTL bookkeeping here anymore: the backend already
// scopes every row to the logged-in user, so there's nothing left to filter
// client-side (see registry.svelte.ts).
export type SessionValue = {
	sessionUID: string;

	thumbnail: string | null; // data URI, or null if none was saved yet

	brief: {
		patientName: string | null;
		patientBirthdate: Date | null;
		patientUID: string | null;
	};

	sidePresent: boolean;
	frontalPresent: boolean;

	lastAccessed: number;
};
