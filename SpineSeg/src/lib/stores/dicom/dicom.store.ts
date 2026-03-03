import { writable } from "svelte/store";
import { persistentCacheWritable } from "$lib/utils/persistentWritable";

import type { DicomHierarchy } from "./dicom.type";

export const dicomStore = persistentCacheWritable<DicomHierarchy>("dicomStore", {
  patients: {}
});