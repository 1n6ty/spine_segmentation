import { stream_segmentation_events } from '$lib/core/network/segmentation-events';
import type { SegmentationStatus } from '$lib/core/network/types';
import { format_json_to_polygons } from './ref-points';
import { orderAndName } from '$lib/features/editor/logic/orderer';
import type { Polygon } from '$lib/shared/geometry/geometry.type';

// 'checking' is client-only (the brief moment before the SSE connection is
// established) -- not part of the wire SegmentationStatus union.
export type AutofillStatus = SegmentationStatus | 'idle' | 'checking';

/**
 * Watches the segmentation pipeline for one SOP Instance UID and resolves
 * with the AI's points once it reaches 'done'.
 *
 * There is no upload step here anymore -- every DICOM upload now goes
 * through SessionService.uploadFile (session.svelte.ts), which already
 * calls /api/dcm/parse/ once and that alone is what triggers segmentation
 * server-side. This function only *watches*, so it's safe to call any time
 * after upload -- including much later, from an explicit "Autofill" button
 * click -- because /api/dcm/{sop}/segment/events/ self-hydrates from the
 * persisted DicomImage row on every connect: whatever the current status
 * actually is, not a guess about whether an earlier event was missed.
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
export async function watchAutofillStatus(
	sop_instance_uid: string,
	on_status: (status: AutofillStatus) => void
): Promise<Polygon[]> {
	for await (const event of stream_segmentation_events(sop_instance_uid)) {
		on_status(event.status);

		if (event.status === 'done' && event.ref_points) {
			return orderAndName(format_json_to_polygons(event.ref_points));
		}
		if (event.status === 'error') {
			throw new Error('Segmentation failed');
		}
	}

	throw new Error('Segmentation event stream ended without a result');
}
