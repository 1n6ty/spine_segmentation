type DicomImagePixelData = Int16Array | Uint16Array | Uint8Array | null;
type DicomImageMetadata = {
  sopInstanceUID: string;
  rows?: number;
  cols?: number;
  slope: number;
  intercept: number;
  windowCenter: number;
  windowWidth: number;
  isSigned: boolean;
  mmPerPixel: number;
};

type PatientSummary = {
  patientID: string;
  name?: string;
  birthDate?: string;
  sex?: string;
  lastAccessTime: number;

  studies: Record<string, StudySummary>;
};

type StudySummary = {
  studyInstanceUID: string;
  studyDate?: string;
  description?: string;
  facility: Facility;
  physicianName?: string;
  lastAccessTime: number;

  series: Record<string, SeriesSummary>;
};

type Facility = {
  institutionName?: string;
  institutionAddress?: string;
  stationName?: string;
};

type SeriesSummary = {
  seriesInstanceUID: string;
  modality?: string;
  bodyPart?: string;

  images: Record<string, DicomImageMetadata>;
};

type DicomRegistry = { patients: Record<string, PatientSummary> };

export type { DicomRegistry, PatientSummary, StudySummary, Facility, SeriesSummary, DicomImageMetadata, DicomImagePixelData };