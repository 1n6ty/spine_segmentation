import { persistentCacheWritable } from "$lib/features/persistentWritable";
import { writable } from "svelte/store";

import type { DicomRegistry, DicomImagePixelData } from "./dicom.type";

let cacheLoaded = writable<boolean>(false);

const dicomRegistryStore = persistentCacheWritable<DicomRegistry>("dicomRegistryStore", {
  patients: {}
}, () => { cacheLoaded.set(true); });

const dicomSidePixelDataStore = writable<DicomImagePixelData>(null),
      dicomFrontalPixelDataStore = writable<DicomImagePixelData>(null);

export { dicomRegistryStore, dicomSidePixelDataStore, dicomFrontalPixelDataStore, cacheLoaded };