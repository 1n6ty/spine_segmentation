import { post } from '$lib/core/network/client';
import { stream_segmentation_events } from '$lib/core/network/segmentation-events';
import type { SegmentationRefPoints } from '$lib/core/network/types';
import { format_json_to_polygons } from './ref-points';
import { orderAndName } from '$lib/features/editor/logic/orderer';
import type { Polygon } from '$lib/shared/geometry/geometry.type';
import type { Projection } from '$lib/features/dicom/types';

export type AutofillStatus =
	| 'idle'
	| 'checking'
	| 'uploading'
	| 'segmentation.processing'
	| 'saving'
	| 'done'
	| 'error';

// Mirrors backend/Mainland/Dicom/management/commands/create_xray_file_roles_if_not_exists.py's
// seeded FileRole slugs -- each capped at max_count=1 per Study, enforced server-side.
const PROJECTION_TO_FILE_ROLE_SLUG: Record<Projection, string> = {
	side: 'DICOM_XRAY_SAGITTAL',
	frontal: 'DICOM_XRAY_FRONTAL'
};

/** Best-effort read of the backend's ApiResponse.details[0].message for a failed
 * /api/dcm/parse/ call (e.g. a FileRole max_count=1-per-Study violation) — falls
 * back to a generic message if the body isn't JSON-shaped as expected. */
async function extract_error_message(res: Response): Promise<string | null> {
	try {
		const body = await res.json();
		return body?.details?.[0]?.message ?? body?.message ?? null;
	} catch {
		return null;
	}
}

async function upload_and_stream(
	sop_instance_uid: string,
	file: File,
	projection: Projection,
	on_status: (status: AutofillStatus) => void
): Promise<SegmentationRefPoints> {
	const form_data = new FormData();
	form_data.append('file', file);
	form_data.append('file_role_slug', PROJECTION_TO_FILE_ROLE_SLUG[projection]);

	const res = await post('/api/dcm/parse/', { form: form_data });
	if (!res.ok) throw new Error((await extract_error_message(res)) ?? 'DICOM upload failed');

	on_status('segmentation.processing');

	for await (const event of stream_segmentation_events(sop_instance_uid)) {
		if (event.status === 'done' && event.ref_points) return event.ref_points;
		if (event.status === 'error') throw new Error('Segmentation failed');
		on_status(event.status as AutofillStatus);
	}

	throw new Error('Segmentation event stream ended without a result');
}

/**
 * Full autofill flow for one projection: upload the DICOM, then stream
 * segmentation status/result over SSE until it's done.
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
	sop_instance_uid: string,
	array_buffer: ArrayBuffer,
	projection: Projection,
	on_status: (status: AutofillStatus) => void
): Promise<Polygon[]> {
	on_status('uploading');
	const file = new File([array_buffer], `${sop_instance_uid}.dcm`, { type: 'application/dicom' });
	const ref_points = await upload_and_stream(sop_instance_uid, file, projection, on_status);

	const raw_polygons = format_json_to_polygons(ref_points);
	return orderAndName(raw_polygons);
}
