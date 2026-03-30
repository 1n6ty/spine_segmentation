import type { PatientSummary, Facility, StudySummary, SeriesSummary, DicomImageMetadata } from "$lib/stores/dicom/dicom.type";

import * as dicomParser from "dicom-parser";
import { dicomRegistryStore, dicomSidePixelDataStore, dicomFrontalPixelDataStore } from "$lib/stores/dicom/dicom.store";
import { currentPatientStore } from "$lib/stores/patient/patient.store";
import { PUBLIC_MAX_PATIENTS_COUNT, PUBLIC_MAX_STUDIES_PER_PATIENT_COUNT } from '$env/static/public';
import { PixelCache } from "./dicomPixelDataCache";
import { createProjectionSocket, frontalProcessingStatusStore, sideProcessingStatusStore } from "$lib/stores/websocket/xraysockets.store";
import type { Polygon } from "$lib/utils/geometry/geometry.type";

import { autoPolygons } from "$lib/stores/study/study.store";

export interface ParsedDicomImage {
  pixelData: Int16Array | Uint16Array | Uint8Array;
  metadata: DicomImageMetadata;
}

export function formatJson2Polygons(data: any): Polygon[] {
  console.log(data.vertebraes.map((e: any) => {
    return {
      id: e.name,
      points: e.points.map((p: any) => {
        return { x: p[0], y: p[1] };
      })
    }
  }));
  return data.vertebraes.map((e: any) => {
    return {
      id: e.name,
      points: e.points.map((p: any) => {
        return { x: p[0], y: p[1] };
      })
    }
  })
}

/**
 * Extracts metadata and a safely aligned TypedArray of pixel data.
 */
export function extractDicomData(dataSet: any): ParsedDicomImage {
  // 1. Check for Compression
  const transferSyntax = dataSet.string("x00020010") || "1.2.840.10008.1.2.1";
  const isCompressed = ![
    "1.2.840.10008.1.2",   // Implicit VR Little Endian
    "1.2.840.10008.1.2.1", // Explicit VR Little Endian
    "1.2.840.10008.1.2.2"  // Explicit VR Big Endian
  ].includes(transferSyntax);

  if (isCompressed) {
    throw new Error(`Compressed Transfer Syntax (${transferSyntax}) requires a specialized decoder.`);
  }

  // 2. Locate Pixel Data
  const element = dataSet.elements.x7fe00010;
  if (!element || element.length === 0) {
    throw new Error("No pixel data found in DICOM file.");
  }

  // 3. Handle Buffer Alignment safely via slice
  const pixelBuffer = dataSet.byteArray.buffer.slice(
    element.dataOffset,
    element.dataOffset + element.length
  );

  // 4. Parse Spacing
  const spacingString = dataSet.string("x00280030") || dataSet.string("x00181164") || "1.0\\1.0";
  const [rowSpacing, colSpacing] = spacingString.split('\\').map(Number);

  // 5. Construct Metadata matching your exact structure
  const metadata: DicomImageMetadata = {
    sopInstanceUID: dataSet.string("x00080018")!,
    rows: dataSet.uint16("x00280010"),
    cols: dataSet.uint16("x00280011"),
    slope: Number(dataSet.string("x00281053") || 1),
    intercept: Number(dataSet.string("x00281052") || 0),
    windowCenter: Number(dataSet.string("x00281050") || 0),
    windowWidth: Number(dataSet.string("x00281051") || 0),
    isSigned: dataSet.uint16("x00280103") === 1,
    mmPerPixel: rowSpacing || 1.0
  };

  // 6. Generate the correct TypedArray for the pixels
  const bitsAllocated = dataSet.uint16("x00280100") || 16;
  let pixelData: Int16Array | Uint16Array | Uint8Array;

  if (bitsAllocated === 8) {
    pixelData = new Uint8Array(pixelBuffer);
  } else {
    pixelData = metadata.isSigned
      ? new Int16Array(pixelBuffer)
      : new Uint16Array(pixelBuffer);
  }

  return { pixelData, metadata };
}

function replaceNonMissing<T>(existing: T, incoming: T): T {
  const result = { ...existing };

  for (const key in incoming) {
    if (incoming[key as keyof T] !== undefined && typeof incoming[key as keyof T] !== "object") {
      result[key as keyof T] = incoming[key as keyof T];
    }
  }

  return result;
}

export async function parseAndStoreDicom(file: File, projection: "frontal" | "side") {
  const buffer = await file.arrayBuffer();
  const byteArray = new Uint8Array(buffer);
  const dataSet = dicomParser.parseDicom(byteArray);

  const accessTime = Date.now();

  // ---------------------
  // PATIENT
  // ---------------------
  const newPatient: PatientSummary = {
    patientID: dataSet.string("x00100020") || crypto.randomUUID(),
    name: dataSet.string("x00100010"),
    birthDate: dataSet.string("x00100030"),
    sex: dataSet.string("x00100040"),
    lastAccessTime: accessTime,
    studies: {}
  }

  // ---------------------
  // FACILITY
  // ---------------------
  const newFacility: Facility = {
    institutionName: dataSet.string('x00080080'),
    institutionAddress: dataSet.string('x00080081'),
    stationName: dataSet.string('x00081010')
  }

  // ---------------------
  // STUDY
  // ---------------------
  const newStudy: StudySummary = {
    studyInstanceUID: dataSet.string("x0020000d")!,
    studyDate: dataSet.string("x00080020"),
    description: dataSet.string("x00081030"),
    lastAccessTime: accessTime,
    physicianName: dataSet.string('x00080090'),
    facility: {},
    series: {}
  }

  // ---------------------
  // SERIES
  // ---------------------
  const newSeries: SeriesSummary = {
    seriesInstanceUID: dataSet.string("x0020000e")!,
    modality: dataSet.string("x00080060"),
    bodyPart: dataSet.string("x00180015"),
    images: {}
  }

  // ---------------------
  // IMAGE
  // ---------------------
  const pixelDataRaw = new Uint8Array(
    dataSet.byteArray.buffer,
    dataSet.elements.x7fe00010!.dataOffset,
    dataSet.elements.x7fe00010!.length
  );

  const pixelBuffer = pixelDataRaw.buffer.slice(
    pixelDataRaw.byteOffset,
    pixelDataRaw.byteOffset + pixelDataRaw.byteLength
  );

  const spacingString = dataSet.string("x00280030") || dataSet.string("x00181164") || "1.0\\1.0";
  const [rowSpacing, colSpacing] = spacingString.split('\\').map(Number);

  const newImage: DicomImageMetadata = {
    sopInstanceUID: dataSet.string("x00080018")!,
    rows: dataSet.uint16("x00280010"),
    cols: dataSet.uint16("x00280011"),
    slope: Number(dataSet.string("x00281053") || 1),
    intercept: Number(dataSet.string("x00281052") || 0),
    windowCenter: Number(dataSet.string("x00281050") || 0),
    windowWidth: Number(dataSet.string("x00281051") || 0),
    isSigned: dataSet.uint16("x00280103") === 1,
    mmPerPixel: rowSpacing || 1.0
  };

  const dicomPixelData = newImage.isSigned
  ? new Int16Array(pixelBuffer)
  : new Uint16Array(pixelBuffer);

  PixelCache.save(newImage.sopInstanceUID, dicomPixelData);

  dicomRegistryStore.update(store => {
    // Patient
    if (!store.patients[newPatient.patientID] && Object.keys(store.patients).length >= parseInt(PUBLIC_MAX_PATIENTS_COUNT)) {
      let patientIDs = Object.keys(store.patients);
      let earliestID = patientIDs[0];

      for (const id of patientIDs) {
          if (store.patients[id].lastAccessTime < store.patients[earliestID].lastAccessTime) earliestID = id;
      }

      Object.keys(store.patients[earliestID].studies).forEach(keyStudy => {
        Object.keys(store.patients[earliestID].studies[keyStudy].series).forEach(keySeries => {
          Object.keys(store.patients[earliestID].studies[keyStudy].series[keySeries].images).forEach(keyImage => {
            PixelCache.clear(keyImage);
          });
        });
      });

      delete store.patients[earliestID];
    }

    if (!store.patients[newPatient.patientID]) {
      store.patients[newPatient.patientID] = newPatient;
    } else {
      store.patients[newPatient.patientID] = replaceNonMissing(store.patients[newPatient.patientID], newPatient);
    }

    const patient = store.patients[newPatient.patientID];

    // Study
    if (!patient.studies[newStudy.studyInstanceUID] && Object.keys(patient.studies).length >= parseInt(PUBLIC_MAX_STUDIES_PER_PATIENT_COUNT)) {
      let studiesIDs = Object.keys(patient.studies);
      let earliestID = studiesIDs[0];

      for (const id of studiesIDs) {
          if (patient.studies[id].lastAccessTime < patient.studies[earliestID].lastAccessTime) earliestID = id;
      }

      Object.keys(patient.studies[earliestID].series).forEach(keySeries => {
        Object.keys(patient.studies[earliestID].series[keySeries].images).forEach(keyImage => {
          PixelCache.clear(keyImage);
        });
      });

      delete patient.studies[earliestID];
    }

    if (!patient.studies[newStudy.studyInstanceUID]) {
      patient.studies[newStudy.studyInstanceUID] = newStudy;
    } else {
      patient.studies[newStudy.studyInstanceUID] = replaceNonMissing(patient.studies[newStudy.studyInstanceUID], newStudy);
    }

    const study = patient.studies[newStudy.studyInstanceUID];

    // Facility
    if (Object.keys(study.facility).length == 0) {
      study.facility = newFacility;
    } else {
      study.facility = replaceNonMissing(study.facility, newFacility);
    }

    // Series
    if (!study.series[newSeries.seriesInstanceUID]) {
      study.series[newSeries.seriesInstanceUID] = newSeries;
    } else {
      study.series[newSeries.seriesInstanceUID] = replaceNonMissing(study.series[newSeries.seriesInstanceUID], newSeries);
    }

    const series = study.series[newSeries.seriesInstanceUID];

    // Image
    if (!series.images[newImage.sopInstanceUID]) {
      series.images[newImage.sopInstanceUID] = newImage;
    } else {
      series.images[newImage.sopInstanceUID] = replaceNonMissing(series.images[newImage.sopInstanceUID], newImage);
    }

    return store;
  });

  currentPatientStore.update(store => {
    if(!(store.patientID == newPatient.patientID && store.studyUID == newStudy.studyInstanceUID && store.seriesUID == newSeries.seriesInstanceUID)){
      store.patientID = newPatient.patientID;
      store.studyUID = newStudy.studyInstanceUID;
      store.seriesUID = newSeries.seriesInstanceUID;
      store.projectionsSopUID = { frontal: "", side: "" };
    }

    store.projectionsSopUID[projection] = newImage.sopInstanceUID;

    return store;
  });

  if (projection == "side") {
    dicomSidePixelDataStore.set(dicomPixelData);
  } else if (projection == "frontal") {
    dicomFrontalPixelDataStore.set(dicomPixelData);
  }

  const processingStatusStore = (projection == "side") ? sideProcessingStatusStore: frontalProcessingStatusStore;

  autoPolygons.update(store => {
    store[projection] = [];
    return store;
  })
  processingStatusStore.set("image.processing");

  fetch('/api/dsl/select/', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': window.CSRF_TOKEN
    },
    body: JSON.stringify({
      "dataset": "dicom_images",
      "select": [
        "ref_points"
      ],
      "filter": {
        "field": "sop_uid",
        "op": "eq",
        "value": newImage.sopInstanceUID
      }
    })
  })
  .then(response => {
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  })
  .then(data => {
    if (data.data.meta.total_items > 0) {
      processingStatusStore.set("done");
      autoPolygons.update(store => {
        store[projection] = formatJson2Polygons(data.data.result[0].ref_points);
        return store;
      })
    } else {
      createProjectionSocket(
        projection,
        newImage.sopInstanceUID,
        () => {
          const formData = new FormData();
          formData.append('file', file);

          console.log(`Socket open. Starting upload for ${newImage.sopInstanceUID}...`);

          fetch('/api/dcm/parse/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': window.CSRF_TOKEN
            },
            body: formData,
          })
          .then(response => {
            if (!response.ok) throw new Error('Upload failed');
            return response.json();
          })
          .then(data => {
            console.log("Upload complete. Server is now processing.");
          })
          .catch(err => {
            console.error("Upload error:", err);
          });
        }
      );
    }
  })
  .catch(err => {
    console.error("Upload error:", err);
  });
}