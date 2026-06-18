import pydicom, uuid, hashlib
from asgiref.sync import sync_to_async

from django.utils import timezone
from channels.layers import get_channel_layer

from Dicom.models import Patient, Study, Series, DicomImage
from Dicom.tasks.segmentation import segment_vertebraes

def calculate_file_hash(file_obj):
    """Calculates the SHA-256 hash of a file object."""
    sha256_hash = hashlib.sha256()
    
    # Ensure we are reading from the start of the file
    file_obj.seek(0)
    
    # Read in 4KB chunks
    for chunk in iter(lambda: file_obj.read(4096), b""):
        sha256_hash.update(chunk)
        
    # Reset the file pointer so it can be read again by pydicom/Django later
    file_obj.seek(0)
    
    return sha256_hash.hexdigest()

def get_dcm_value(dcm, keyword, default=None):
    """Safely extracts a value from a pydicom dataset."""
    if keyword in dcm:
        val = dcm.data_element(keyword).value
        # pydicom often returns MultiValue or PersonName objects; cast to standard types
        if isinstance(val, pydicom.valuerep.PersonName):
            return str(val)
        if isinstance(val, pydicom.multival.MultiValue):
            return float(val[0]) if val else default # Take first value for windowing/spacing
        return val
    return default

def get_projection_orientation(ds):
    """
    Determines if a DICOM image is Frontal or Side (Lateral).
    
    Args:
        ds: A pydicom Dataset object
        
    Returns:
        str: 'Frontal', 'Side', or None
    """
    # 1. Check the primary ViewPosition tag (0018, 5101)
    view = ds.get("ViewPosition", "").upper()
    
    frontal_codes = ["AP", "PA", "PA-DR", "AP-DR"]
    side_codes = ["LAT", "LL", "RL", "LATERAL", "LLD", "RLD"]

    if any(code in view for code in frontal_codes):
        return "frontal"
    if any(code in view for code in side_codes):
        return "sagittal"

    # 2. Fallback: Check Patient Orientation (0020, 0020)
    # Frontal rows usually go Left/Right ('L' or 'R')
    # Side (Lateral) rows usually go Anterior/Posterior ('A' or 'P')
    orientation = ds.get("PatientOrientation", [])
    if orientation and len(orientation) > 0:
        first_char = str(orientation[0])[0].upper()
        if first_char in ["L", "R"]:
            return "frontal"
        elif first_char in ["A", "P"]:
            return "sagittal"

    # 3. Last Resort: Check Series Description for keywords
    description = ds.get("SeriesDescription", "").upper()
    if "LAT" in description:
        return "sagittal"
    if "AP" in description or "PA" in description:
        return "frontal"

    return None

async def parse_and_store_dicom(file_obj):
    """
    Parses an uploaded DICOM file and stores/updates its metadata in the database.
    file_obj: An InMemoryUploadedFile or file-like object
    projection: 'frontal' or 'side'
    """
    # 1. Parse the DICOM file
    dcm = await sync_to_async(pydicom.dcmread)(file_obj)
    now = timezone.now()

    # 2. Extract and Store Patient
    patient_id = get_dcm_value(dcm, 'PatientID') or str(uuid.uuid4())
    patient_defaults = {
        'name': get_dcm_value(dcm, 'PatientName'),
        'birth_date': get_dcm_value(dcm, 'PatientBirthDate'),
        'sex': get_dcm_value(dcm, 'PatientSex'),
        'last_access_time': now
    }

    patient, _ = await Patient.objects.aupdate_or_create(
        patient_id=patient_id,
        defaults={k: v for k, v in patient_defaults.items() if v is not None}
    )

    # 3. Extract and Store Study (Including Facility info)
    study_uid = get_dcm_value(dcm, 'StudyInstanceUID')
    if not study_uid:
        raise ValueError("DICOM file missing StudyInstanceUID")

    study_defaults = {
        'patient': patient,
        'study_date': get_dcm_value(dcm, 'StudyDate'),
        'description': get_dcm_value(dcm, 'StudyDescription'),
        'physician_name': get_dcm_value(dcm, 'ReferringPhysicianName'),
        'institution_name': get_dcm_value(dcm, 'InstitutionName'),
        'institution_address': get_dcm_value(dcm, 'InstitutionAddress'),
        'station_name': get_dcm_value(dcm, 'StationName'),
        'last_access_time': now
    }
    study, _ = await Study.objects.aupdate_or_create(
        study_instance_uid=study_uid,
        defaults={k: v for k, v in study_defaults.items() if v is not None}
    )

    # 4. Extract and Store Series
    series_uid = get_dcm_value(dcm, 'SeriesInstanceUID')
    if not series_uid:
        raise ValueError("DICOM file missing SeriesInstanceUID")

    series_defaults = {
        'study': study,
        'modality': get_dcm_value(dcm, 'Modality'),
        'body_part': get_dcm_value(dcm, 'BodyPartExamined')
    }
    series, _ = await Series.objects.aupdate_or_create(
        series_instance_uid=series_uid,
        defaults={k: v for k, v in series_defaults.items() if v is not None}
    )

    # 5. Extract and Store Image
    sop_uid = get_dcm_value(dcm, 'SOPInstanceUID')
    if not sop_uid:
        raise ValueError("DICOM file missing SOPInstanceUID")

    # Handle pixel spacing safely
    spacing = get_dcm_value(dcm, 'PixelSpacing') or get_dcm_value(dcm, 'ImagerPixelSpacing')
    mm_per_pixel = float(spacing[0]) if isinstance(spacing, pydicom.multival.MultiValue) else 1.0

    new_file_hash = calculate_file_hash(file_obj)
    existing_image = await DicomImage.objects.filter(sop_instance_uid=sop_uid).afirst()
    
    content_changed = False
    if not existing_image or existing_image.file_hash != new_file_hash:
        content_changed = True

    image_defaults = {
        'series': series,
        'projection': get_projection_orientation(dcm),
        'rows': get_dcm_value(dcm, 'Rows'),
        'cols': get_dcm_value(dcm, 'Columns'),
        'slope': float(get_dcm_value(dcm, 'RescaleSlope', 1.0)),
        'intercept': float(get_dcm_value(dcm, 'RescaleIntercept', 0.0)),
        'window_center': float(get_dcm_value(dcm, 'WindowCenter', 0.0)),
        'window_width': float(get_dcm_value(dcm, 'WindowWidth', 0.0)),
        'is_signed': get_dcm_value(dcm, 'PixelRepresentation', 0) == 1,
        'mm_per_pixel': mm_per_pixel,
        'file_hash': new_file_hash
    }

    image, _ = await DicomImage.objects.aupdate_or_create(
        sop_instance_uid=sop_uid,
        defaults={k: v for k, v in image_defaults.items() if v is not None}
    )

    channel_layer = get_channel_layer()
    # Save the actual file to the model's FileField
    if content_changed or True: #TODO Change it (DEBUG only)
        await channel_layer.group_send(
            f"Dicom.segment.{sop_uid}",
            {
                "type": "from_task_event",
                "data": {
                    "status": "image.processing"
                },
            }
        )
        file_obj.seek(0)
        await sync_to_async(image.dicom_file.save)(f"{sop_uid}.dcm", file_obj, save=True)

        segment_vertebraes.delay(sop_uid)

    return patient, study, series, image