from django.db.models import Q

from DSL.datasets.schema import DatasetField, DatasetSpec

from Dicom.models import DicomImage

DICOM_IMAGES_DATASET = DatasetSpec(
    name="dicom_images",
    description="Flat dataset of individual DICOM images",
    model=DicomImage,
    permissions=[],
    default_filters=Q(),
    fields={
        # --- Image Fields (Direct) ---
        "sop_uid": DatasetField(
            description="Unique Service Object Pair (SOP) Instance UID",
            source="sop_instance_uid",
            type="string",
            permissions=[]
        ),
        "projection": DatasetField(
            description="Image projection (frontal/sagittal)",
            source="projection",
            type="string",
            permissions=[]
        ),
        "rows": DatasetField(
            description="Image height in pixels",
            source="rows",
            type="number",
            permissions=[]
        ),
        "cols": DatasetField(
            description="Image width in pixels",
            source="cols",
            type="number",
            permissions=[]
        ),
        "mm_per_pixel": DatasetField(
            description="Pixel spacing in millimeters",
            source="mm_per_pixel",
            type="number",
            permissions=[]
        ),
        "window_center": DatasetField(
            description="DICOM Window Center (Level)",
            source="window_center",
            type="number",
            permissions=[]
        ),
        "window_width": DatasetField(
            description="DICOM Window Width",
            source="window_width",
            type="number",
            permissions=[]
        ),
        "ref_points": DatasetField(
            description="JSON storage for AI reference points",
            source="reference_points",
            type="json",
            permissions=[]
        ),
        "dicom_file_path": DatasetField(
            description="Path to the physical .dcm file",
            source="dicom_file",
            type="url",
            permissions=[]
        ),
    }
)