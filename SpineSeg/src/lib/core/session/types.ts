import type { Projection } from "$lib/features/dicom/types";
import type { Polygon } from "$lib/shared/geometry/geometry.type";

export interface Serializable {
  /**
   * Converts the current state of the class into a plain JSON-serializable object.
   */
  dump(): Object
}

export type SessionProjection = {
  hash: string;
  polygons: Polygon[];
};

export type SessionValue = {
  sessionUID: string;

  thumbnail: Blob | null;
  brief: {
    patientName: string | null,
    patientBirthdate: Date | null,
    patientUID: string | null
  };

  projections: Record<Projection, SessionProjection>;

  lastAccessed: number;
};

