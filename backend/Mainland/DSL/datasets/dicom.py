from django.db.models import Q

from DSL.datasets.schema import DatasetSpec, DatasetField

from Dicom.models import DicomImage

DICOM_DATASET = DatasetSpec(
    name="dicom",
    description="Flat dataset of individual DICOM images with associated Series, Study, and Patient info",
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

        # --- Series Fields (via 'series') ---
        "series_uid": DatasetField(
            description="Series Instance UID",
            source="series__series_instance_uid",
            type="string",
            permissions=[]
        ),
        "modality": DatasetField(
            description="Modality (e.g., CT, MR, DX)",
            source="series__modality",
            type="string",
            permissions=[]
        ),
        "body_part": DatasetField(
            description="Body part examined",
            source="series__body_part",
            type="string",
            permissions=[]
        ),

        # --- Study Fields (via 'series__study') ---
        "study_uid": DatasetField(
            description="Study Instance UID",
            source="series__study__study_instance_uid",
            type="string",
            permissions=[]
        ),
        "study_date": DatasetField(
            description="Date the study was performed",
            source="series__study__study_date",
            type="string",
            permissions=[]
        ),
        "study_description": DatasetField(
            description="Description of the study",
            source="series__study__description",
            type="string",
            permissions=[]
        ),
        "institution": DatasetField(
            description="Name of the institution",
            source="series__study__institution_name",
            type="string",
            permissions=[]
        ),

        # --- Patient Fields (via 'series__study__patient') ---
        "patient_id": DatasetField(
            description="Unique Patient ID",
            source="series__study__patient__patient_id",
            type="string",
            permissions=[]
        ),
        "patient_name": DatasetField(
            description="Patient Name",
            source="series__study__patient__name",
            type="string",
            permissions=[]
        ),
        "patient_sex": DatasetField(
            description="Patient Sex",
            source="series__study__patient__sex",
            type="string",
            permissions=[]
        ),
        "patient_birth_date": DatasetField(
            description="Patient Date of Birth",
            source="series__study__patient__birth_date",
            type="string",
            permissions=[]
        ),
    }
)
