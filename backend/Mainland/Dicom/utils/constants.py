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
