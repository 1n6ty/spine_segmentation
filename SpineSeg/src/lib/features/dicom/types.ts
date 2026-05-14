export type Projection = "side" | "frontal";

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
