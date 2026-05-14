import { FileCache } from "$lib/features/dicom/cache";
import type { Projection } from "$lib/features/dicom/types";
import { PatientService } from "./patient.svelte";
import { registry } from "./registry.svelte";
import type { SessionProjection } from "./types";
import * as dicomParser from 'dicom-parser';

/*
* The strategy here - store and restore everything based on files. Firstly we store
* files in session and then making other objects based on these files.
*/

export class SessionService {
    loadingPromise: Promise<void>;

    sessionUID = $state<string>("");
    lastTimeAccessed = $state<number>(0);
    projections = $state<Record<Projection, SessionProjection & { arrayBuffer: ArrayBuffer | null, patient: PatientService | null }>>(
        {
            side: {
                hash: "",
                arrayBuffer: null,
                patient: null,
                polygons: []
            },
            frontal: {
                hash: "",
                arrayBuffer: null,
                patient: null,
                polygons: []
            }
        }
    );

    private async restoreFromRegistry(sessionUID: string | null) {
        if (!sessionUID) return;

        try {
            const storedSession = await registry.sessionValues[sessionUID];
            if (!storedSession) {
                throw new Error(`Session ${sessionUID} not found in registry`);
            }

            // 1. Fetch all binary data in parallel first
            // This keeps the "logic" separate from the "state update"
            const projectionKeys = Object.keys(this.projections) as Projection[];
            
            const hydrationResults = await Promise.all(
                projectionKeys.map(async (key) => {
                    const storedProj = storedSession.projections[key];
                    if (!storedProj?.hash) return null;

                    const file = await FileCache.load(storedProj.hash);
                    if (!file) {
                        console.warn(`File missing for hash: ${storedProj.hash}`);
                        return null;
                    }

                    const arrayBuffer = await file.arrayBuffer();
                    
                    // Parse DICOM once here to avoid doing it in the render loop
                    const dataSet = dicomParser.parseDicom(new Uint8Array(arrayBuffer));
                    
                    return {
                        key,
                        hash: storedProj.hash,
                        polygons: storedProj.polygons || [],
                        arrayBuffer,
                        patient: new PatientService(this, dataSet)
                    };
                })
            );

            // 2. Batch the state update
            // By updating the local 'this' properties only after all async work is done,
            // we prevent the UI from flickering through "half-loaded" states.
            this.sessionUID = sessionUID;
            this.lastTimeAccessed = storedSession.lastAccessed;

            for (const res of hydrationResults) {
                if (!res) continue;
                
                // Assign to the reactive state
                const target = this.projections[res.key];
                target.hash = res.hash;
                target.polygons = res.polygons;
                target.arrayBuffer = res.arrayBuffer;
                target.patient = res.patient;
            }

            console.log(`Successfully restored session: ${sessionUID}`);

            this.requestSave();

        } catch (error) {
            // Rethrow so the {#await} block catch branch can see it
            console.error("Registry Restoration Critical Error:", error);
            throw error; 
        }
    }

    async uploadFile(file: File, projection: Projection) {
        if(!this.sessionUID) this.sessionUID = crypto.randomUUID();

        this.projections[projection].hash = await FileCache.save(file);
        this.projections[projection].arrayBuffer = await file.arrayBuffer();
        this.projections[projection].patient = new PatientService(
            this,
            dicomParser.parseDicom(
                new Uint8Array(this.projections[projection].arrayBuffer)
            )
        );

        this.requestSave();
    };

    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    async requestSave() {
        if (!this.sessionUID) return;
        if (this.saveTimeout) clearTimeout(this.saveTimeout);

        const bitmap = this.projections.side.patient?.study.series.sopInstance.bitmap 
                    || this.projections.frontal.patient?.study.series.sopInstance.bitmap;

        let thumbnailBlob: Blob | null = null;

        if (bitmap) {
            // 2. Create a tiny offscreen canvas for the thumbnail
            const offscreen = new OffscreenCanvas(128, 128); // Standard thumbnail size
            const ctx = offscreen.getContext('2d');
            
            if (ctx) {
                // Draw and scale the bitmap to fit the 128x128 thumb
                const scale = Math.min(128 / bitmap.width, 128 / bitmap.height);
                const w = bitmap.width * scale;
                const h = bitmap.height * scale;
                ctx.drawImage(bitmap, (128 - w) / 2, (128 - h) / 2, w, h);
                
                // 3. Convert to a compressed Blob
                thumbnailBlob = await offscreen.convertToBlob({ 
                    type: 'image/jpeg', 
                    quality: 0.3
                });
            }
        }

        const patientUID = this.projections.side.patient?.patientUID || this.projections.frontal.patient?.patientUID;
        const patientBirthdate = this.projections.side.patient?.birthDate || this.projections.frontal.patient?.birthDate;
        const patientName = this.projections.side.patient?.name || this.projections.frontal.patient?.name;

        this.saveTimeout = setTimeout(() => {
            this.lastTimeAccessed = Date.now();
            registry.upsert({
                sessionUID: this.sessionUID,
                thumbnail: thumbnailBlob,
                brief: {
                    patientUID: patientUID || null,
                    patientBirthdate: patientBirthdate || null,
                    patientName: patientName || null
                },
                projections: {
                    side: { hash: $state.snapshot(this.projections.side.hash), polygons: $state.snapshot(this.projections.side.polygons) },
                    frontal: { hash: $state.snapshot(this.projections.frontal.hash), polygons: $state.snapshot(this.projections.frontal.polygons) }
                }
            });
        }, 500);
    }

    constructor(sessionUID: string | null) {
        this.loadingPromise = this.restoreFromRegistry(sessionUID);
    }

    destroy() {
        Object.values(this.projections).forEach(p => {
            p.arrayBuffer = null;
            if (p.patient) p.patient.destroy();
        });
    }
};
