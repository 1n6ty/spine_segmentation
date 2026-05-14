import { env } from "$env/dynamic/public";
import { writable } from "svelte/store";
import { createSocket } from "./websocket.store";
import type { SocketStore } from "./websocket.type";
import { autoPolygons } from "../study/study.store";
import { formatJson2Polygons } from "$lib/features/dicomParser";

interface SegmentMessage {
    data: {status: string; ref_points: any}
}

export const sideProcessingStatusStore = writable<string | null>(null);
export const frontalProcessingStatusStore = writable<string | null>(null);

export const createProjectionSocket = (
    projection: "side" | "frontal",
    sopInstanceUID: string,
    onopen = () => {}
): SocketStore => {

    // Select the target store based on projection
    const targetStore = projection === "side" ? sideProcessingStatusStore : frontalProcessingStatusStore;

    return createSocket(
        `wss://${env.PUBLIC_DOMAIN}/ws/dcm/segment/${sopInstanceUID}/`,
        // onopen
        () => {
            targetStore.set("image.processing");
            onopen();
        },
        // onmessage
        (self, data: SegmentMessage) => {
            // Update the status store with the message
            targetStore.set(data.data.status);

            if (data.data.status === "done") {
                autoPolygons.update(store => {
                    store[projection] = formatJson2Polygons(data.data.ref_points);
                    return store;
                })
                self.close();
            }
        },
        // onclose
        () => {
            targetStore.set(null);
        }
    );
};