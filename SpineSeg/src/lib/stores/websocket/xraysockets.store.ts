import { createSocket } from "./websocket.store";
import type { SocketStore } from "./websocket.type";

/**
 * Status values the backend's Celery task actually sends (confirmed from the
 * caller side of `Dicom/tasks/segmentation.py` — see docs/autofill-integration.md).
 */
export type SegmentationStatus = "segmentation.processing" | "saving" | "done";

type SegmentationVertebra = { name: string; points: [number, number][] };
export type SegmentationRefPoints = { vertebraes: SegmentationVertebra[] };

interface SegmentMessage {
    data: { status: SegmentationStatus; ref_points: SegmentationRefPoints | null };
}

/**
 * Opens the segmentation WebSocket for one DICOM instance. Deliberately takes
 * plain callbacks instead of writing into a shared store — there's no longer
 * an `autoPolygons` global (it was a dangling import to a file that never
 * existed); the caller (the autofill orchestration) owns the resulting
 * polygons directly via `project.session`.
 *
 * Uses a relative URL — modern browsers resolve the scheme/host against the
 * current page, so this works unchanged across local dev (http) and any
 * deployed environment (https), without needing a `PUBLIC_DOMAIN` env var
 * (which doesn't exist anywhere in this project's `.env` files).
 */
export function createSegmentationSocket(
    sopInstanceUID: string,
    onStatus: (status: SegmentationStatus) => void,
    onDone: (refPoints: SegmentationRefPoints) => void,
    onClose: () => void
): SocketStore {
    return createSocket(
        `/ws/dcm/segment/${sopInstanceUID}/`,
        () => {},
        (self, data: SegmentMessage) => {
            onStatus(data.data.status);

            if (data.data.status === "done" && data.data.ref_points) {
                onDone(data.data.ref_points);
                self.close();
            }
        },
        () => {
            onClose();
        }
    );
}
