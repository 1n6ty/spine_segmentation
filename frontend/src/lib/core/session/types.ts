import type { Projection } from '$lib/features/dicom/types';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

export type SessionProjection = {
	hash: string;
	polygons: Polygon[];
};

export type SessionValue = {
	sessionUID: string;

	// Which locally-authenticated account this session belongs to — sessions
	// are scoped to `RegistryService.accountId` so switching accounts on the
	// same browser doesn't surface another account's research history.
	accountId: string | null;

	thumbnail: Blob | null;
	brief: {
		patientName: string | null;
		patientBirthdate: Date | null;
		patientUID: string | null;
	};

	projections: Record<Projection, SessionProjection>;

	lastAccessed: number;
};
