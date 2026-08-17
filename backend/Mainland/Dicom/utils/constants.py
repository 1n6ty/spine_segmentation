SEGMENTATION_GROUP = "Dicom.segment.{}"

# .onnx, not .pt: runs through onnxruntime (via sahi/ultralytics' own AutoBackend
# format dispatch, no code changes needed elsewhere) rather than PyTorch eager
# mode, which is faster on CPU. Exported from the original .pt checkpoints with
# `YOLO(path).export(format='onnx', dynamic=True, simplify=True)`; verified
# numerically equivalent to the source .pt (mask-prototype branch matches to
# 1e-6, top-confidence detections to ~6e-5 -- see git history for the export
# session). The .pt originals are kept alongside for reference/re-export, but
# are no longer loaded by the app.
SEGMENTATION_MODEL_WEIGHTS = {
    "sagittal": "Dicom/tasks/weights/yolo26m-seg-sag.onnx",
    "frontal": "Dicom/tasks/weights/yolo26m-seg-fro.onnx",
}

# SegmentationStatus.slug -> wire "status" string sent to the frontend over SSE.
# Kept distinct from the DB slug so the wire contract (matching the frontend's
# existing SegmentationStatus/AutofillStatus TS types) never has to change
# just because the DB-side lookup-table naming does.
SEGMENTATION_STATUS_WIRE = {
    "processing": "segmentation.processing",
    "saving": "saving",
    "done": "done",
    "error": "error",
}

# Wire-status values (SEGMENTATION_STATUS_WIRE's values, not its keys) that close
# the SSE stream once emitted -- see Dicom.v1.views.dcmparse._segmentation_event_stream.
# Each value equals its own key: this exists so call sites reference a named
# constant (TERMINAL_WIRE_STATUSES["error"]) instead of a bare string literal
# that could silently typo out of sync with SEGMENTATION_STATUS_WIRE.
TERMINAL_WIRE_STATUSES = {
    "done": "done",
    "error": "error",
}

# FileManager.FileRole slugs seeded by
# Dicom.management.commands.create_xray_file_roles_if_not_exists -- the single
# source every other reference imports from, instead of each independently
# re-typing the same string (Dicom.utils.parse's DEFAULT_FILE_ROLE_SLUG and
# Dicom.v1.utils.session_images's role-slug filters used to each hardcode
# their own copy, with nothing tying them together).
DICOM_XRAY_SAGITTAL_ROLE_SLUG = "DICOM_XRAY_SAGITTAL"
DICOM_XRAY_FRONTAL_ROLE_SLUG = "DICOM_XRAY_FRONTAL"

# UserRecentStudies projection slugs (Dicom.v1.views.user_recent_studies's
# `projections/<slug>/` route + _POLYGONS_FIELDS) -- the app/session-layer
# vocabulary, distinct from Dicom.models.Projection's DB slugs ('frontal'/
# 'sagittal', seeded by create_projections.py) and from
# DICOM_XRAY_*_ROLE_SLUG above: 'side' is this layer's word for what those
# call 'sagittal'/'DICOM_XRAY_SAGITTAL' (see frontend's
# PROJECTION_TO_FILE_ROLE_SLUG for the same mapping, client-side). Single
# source for the URL route regex and the side<->frontal swap logic, instead
# of each independently re-typing 'side'/'frontal'.
SIDE_PROJECTION_SLUG = "side"
FRONTAL_PROJECTION_SLUG = "frontal"
