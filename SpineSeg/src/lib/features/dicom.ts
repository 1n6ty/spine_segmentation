import type { PatientSummary, Facility, StudySummary, SeriesSummary, DicomImageMetadata, DicomImagePixelData } from "$lib/stores/dicom/dicom.type";

import * as dicomParser from "dicom-parser";
import { dicomRegistryStore, dicomSidePixelDataStore, dicomFrontalPixelDataStore } from "$lib/stores/dicom/dicom.store";
import { currentPatientStore } from "$lib/stores/patient/patient.store";
import { PUBLIC_MAX_PATIENTS_COUNT, PUBLIC_MAX_STUDIES_PER_PATIENT_COUNT } from '$env/static/public';
import { PixelCache } from "./dicomPixelDataCache";

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

  const dicomPixelData: DicomImagePixelData = newImage.isSigned
    ? new Int16Array(
      pixelDataRaw.buffer,
      pixelDataRaw.byteOffset,
      pixelDataRaw.byteLength / 2
    )
    : new Uint16Array(
      pixelDataRaw.buffer,
      pixelDataRaw.byteOffset,
      pixelDataRaw.byteLength / 2
    );

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
}