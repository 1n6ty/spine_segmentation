import pydicom, uuid, hashlib
from asgiref.sync import sync_to_async

from django.utils import timezone
from channels.layers import get_channel_layer

from common.schemas.v1.response import Issue
from Dicom.models import Patient, Study, Series, DicomImage, DicomFile, Projection
from Dicom.tasks.segmentation import segment_vertebraes
from Dicom.utils.constants import SEGMENTATION_GROUP
from FileManager.models import CasFile, FileRole
from FileManager.utils import build_cas_path, check_role_max_count

def calculate_file_hash(file_obj):
    """Calculates the SHA-512 hash of a file object -- matches CasFileMixin.hash's
    width, so this value is directly usable as a DicomFile.hash / CAS path component."""
    sha512_hash = hashlib.sha512()

    # Ensure we are reading from the start of the file
    file_obj.seek(0)

    # Read in 4KB chunks
    for chunk in iter(lambda: file_obj.read(4096), b""):
        sha512_hash.update(chunk)

    # Reset the file pointer so it can be read again by pydicom/Django later
    file_obj.seek(0)

    return sha512_hash.hexdigest()

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

DEFAULT_FILE_ROLE_SLUG = 'DICOM_XRAY_SAGITTAL'

async def parse_and_store_dicom(file_obj, file_role_slug=None):
    """
    Parses an uploaded DICOM file and stores/updates its metadata in the database.
    file_obj: An InMemoryUploadedFile or file-like object
    file_role_slug: FileRole slug to file this DICOM under (e.g. 'DICOM_XRAY_FRONTAL').
        Caller-controlled, not derived from DICOM tags -- unlike `projection` below,
        which is always auto-detected. Falls back to DEFAULT_FILE_ROLE_SLUG when
        omitted/falsy.

    Returns (patient, study, series, image) on success, or an Issue if file_role_slug
    doesn't name an existing FileRole, or if the upload violates that role's
    max_count=1-per-Study rule -- the caller (Dicom.v1.views.dcmparse.DcmViewSet.parse)
    is responsible for turning that Issue into a 400 response, matching how every other
    validation failure in this codebase surfaces (see Profile.v1.views.profiles for the
    same idiom).
    """
    # 1. Parse the DICOM file
    dcm = await sync_to_async(pydicom.dcmread)(file_obj)
    now = timezone.now()
    new_file_hash = calculate_file_hash(file_obj)

    sop_uid = get_dcm_value(dcm, 'SOPInstanceUID')
    if not sop_uid:
        raise ValueError("DICOM file missing SOPInstanceUID")

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

    # 3b. Resolve the caller-declared FileRole (defaulting to sagittal) and enforce its
    # max_count=1-per-Study rule before writing Series/Image -- excluding this SOP
    # Instance UID's own existing row (if any) from the count is what makes re-uploading
    # the same image a no-op instead of tripping the limit against itself. `projection`
    # (clinical metadata) is unrelated and always auto-detected from DICOM tags below,
    # regardless of which role was requested.
    projection_slug = get_projection_orientation(dcm)
    projection = await Projection.objects.filter(slug=projection_slug).afirst() if projection_slug else None

    role_slug = file_role_slug or DEFAULT_FILE_ROLE_SLUG
    role = await FileRole.objects.filter(slug=role_slug).afirst()
    if role is None:
        return Issue(
            status="error", code=400, field="file_role_slug",
            message=f"FileRole '{role_slug}' does not exist.",
        )
    if role.max_count is not None:
        existing_count = await DicomFile.objects.filter(
            study=study, role=role
        ).exclude(image_id=sop_uid).acount()
        issue = check_role_max_count(role, existing_count, 1)
        if issue:
            return issue

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
    # Handle pixel spacing safely
    spacing = get_dcm_value(dcm, 'PixelSpacing') or get_dcm_value(dcm, 'ImagerPixelSpacing')
    mm_per_pixel = float(spacing[0]) if isinstance(spacing, pydicom.multival.MultiValue) else 1.0

    existing_file_record = await DicomFile.objects.filter(image_id=sop_uid).afirst()
    content_changed = existing_file_record is None or existing_file_record.hash != new_file_hash

    image_defaults = {
        'series': series,
        'projection': projection,
        'rows': get_dcm_value(dcm, 'Rows'),
        'cols': get_dcm_value(dcm, 'Columns'),
        'slope': float(get_dcm_value(dcm, 'RescaleSlope', 1.0)),
        'intercept': float(get_dcm_value(dcm, 'RescaleIntercept', 0.0)),
        'window_center': float(get_dcm_value(dcm, 'WindowCenter', 0.0)),
        'window_width': float(get_dcm_value(dcm, 'WindowWidth', 0.0)),
        'is_signed': get_dcm_value(dcm, 'PixelRepresentation', 0) == 1,
        'mm_per_pixel': mm_per_pixel,
    }

    image, _ = await DicomImage.objects.aupdate_or_create(
        sop_instance_uid=sop_uid,
        defaults={k: v for k, v in image_defaults.items() if v is not None}
    )

    # CAS-write the file only when its content actually changed -- re-uploading
    # identical bytes for the same image is a no-op past this point (no redundant
    # ref_count churn, no redundant segmentation run).
    if content_changed:
        if existing_file_record is not None:
            # Never re-point an existing CasFileMixin row's `.file` at a different
            # CAS path in place -- CasFile ref-counting only fires on post_save
            # (created=True) / post_delete, so an in-place `.file` reassignment
            # would silently skip incrementing the new path's ref_count and never
            # decrement the old one. Delete + recreate instead, matching how
            # content replacement is handled everywhere else CasFileMixin is used.
            await existing_file_record.adelete()

        path = build_cas_path(new_file_hash)
        file_record = DicomFile(
            image=image, study=study, role=role,
            name=f"{sop_uid}.dcm",
            content_type='application/dicom',
            size=getattr(file_obj, 'size', None) or 0,
            hash=new_file_hash,
        )
        if await CasFile.objects.filter(path=path).aexists():
            file_record.file.name = path
            await file_record.asave()
        else:
            file_obj.seek(0)
            await sync_to_async(file_record.file.save)(path, file_obj, save=True)

        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            SEGMENTATION_GROUP.format(sop_uid),
            {
                "type": "from_task_event",
                "data": {
                    "status": "image.processing"
                },
            }
        )
        segment_vertebraes.delay(sop_uid)

    return patient, study, series, image