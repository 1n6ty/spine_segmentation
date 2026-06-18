import { getCSRFToken } from "$lib/core/network/csrf";
import { createSegmentationSocket, type SegmentationStatus, type SegmentationRefPoints } from "$lib/stores/websocket/xraysockets.store";
import { formatJson2Polygons } from "$lib/features/dicomParser";
import { orderAndName } from "$lib/features/editor/logic/orderer";
import type { Polygon } from "$lib/shared/geometry/geometry.type";

export type AutofillStatus =
    | "idle"
    | "checking"
    | "uploading"
    | "segmentation.processing"
    | "saving"
    | "done"
    | "error";

type DslSelectResponse = {
    data: {
        meta: { total_items: number };
        result: { ref_points: SegmentationRefPoints }[];
    };
};

async function checkCache(sopInstanceUID: string): Promise<SegmentationRefPoints | null> {
    const res = await fetch("/api/dsl/select/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCSRFToken() ?? ""
        },
        body: JSON.stringify({
            dataset: "dicom_images",
            select: ["ref_points"],
            filter: { field: "sop_uid", op: "eq", value: sopInstanceUID }
        })
    });

    if (!res.ok) throw new Error("DSL select request failed");

    const body: DslSelectResponse = await res.json();
    const refPoints = body.data.meta.total_items > 0 ? body.data.result[0]?.ref_points : null;
    return refPoints && refPoints.vertebraes?.length > 0 ? refPoints : null;
}

function uploadAndSegment(
    sopInstanceUID: string,
    file: File,
    onStatus: (status: AutofillStatus) => void
): Promise<SegmentationRefPoints> {
    return new Promise((resolve, reject) => {
        let settled = false;

        const socket = createSegmentationSocket(
            sopInstanceUID,
            (status: SegmentationStatus) => onStatus(status),
            (refPoints) => {
                settled = true;
                resolve(refPoints);
            },
            () => {
                if (!settled) {
                    settled = true;
                    reject(new Error("Segmentation socket closed before completion"));
                }
            }
        );

        const formData = new FormData();
        formData.append("file", file);

        fetch("/api/dcm/parse/", {
            method: "POST",
            headers: { "X-CSRFToken": getCSRFToken() ?? "" },
            body: formData
        })
            .then((res) => {
                if (!res.ok && !settled) {
                    settled = true;
                    socket.close();
                    reject(new Error("DICOM upload failed"));
                }
            })
            .catch((err) => {
                if (!settled) {
                    settled = true;
                    socket.close();
                    reject(err);
                }
            });
    });
}

/**
 * Full autofill flow for one projection: DSL cache-check first, then (on a
 * miss) open the segmentation WebSocket and upload the DICOM file.
 *
 * The result is ALWAYS run through `orderAndName` before being returned —
 * deliberate, not optional. `orderAndName` is proven (verified empirically in
 * an earlier session, across different click orders and curved-spine
 * arrangements) to normalize any input point order to this app's
 * `[bottom-left, top-left, top-right, bottom-right]` convention, which every
 * calculator in `medical-parameters/` depends on. The backend's own YOLO
 * postprocessing point/name convention is unverified — `Dicom/utils/` was
 * intentionally not read — so AI-derived polygons are never trusted as-is,
 * exactly like manually-drawn ones aren't either.
 */
export async function runAutofill(
    sopInstanceUID: string,
    arrayBuffer: ArrayBuffer,
    onStatus: (status: AutofillStatus) => void
): Promise<Polygon[]> {
    onStatus("checking");
    const cached = await checkCache(sopInstanceUID);

    const refPoints = cached ?? await (async () => {
        onStatus("uploading");
        const file = new File([arrayBuffer], `${sopInstanceUID}.dcm`, { type: "application/dicom" });
        return uploadAndSegment(sopInstanceUID, file, onStatus);
    })();

    const rawPolygons = formatJson2Polygons(refPoints);
    return orderAndName(rawPolygons);
}
