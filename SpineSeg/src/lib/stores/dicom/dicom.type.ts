type DicomHierarchy = {
  patients: Record<string, Patient>;
};

type Patient = {
  patientID: string;
  name?: string;
  birthDate?: string;
  sex?: string;
  lastAccessTime: number;

  studies: Record<string, Study>;
};

type Facility = {
  institutionName?: string;
  institutionAddress?: string;
  stationName?: string;
};

type Study = {
  studyInstanceUID: string;
  studyDate?: string;
  description?: string;
  facility: Facility;
  physicianName?: string;
  lastAccessTime: number;

  series: Record<string, Series>;
};

type Series = {
  seriesInstanceUID: string;
  modality?: string;
  bodyPart?: string;

  images: Record<string, DicomImage>;
};

type DicomImage = {
  sopInstanceUID: string;
  rows: number | undefined;
  cols: number | undefined;
  pixelData: Int16Array | Uint16Array | Uint8Array;
  slope: number;
  intercept: number;
  windowCenter: number;
  windowWidth: number;
};

export type { DicomHierarchy, DicomImage, Series, Study, Patient, Facility };