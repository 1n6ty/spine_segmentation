import pydicom, uuid, hashlib
from asgiref.sync import sync_to_async
from logging import getLogger
_logger = getLogger('Dicom.utils.parse')

from django.utils import timezone

from common.schemas.v1.response import Issue
from Dicom.models import Patient, Study, Series, DicomImage, DicomFile, Projection
from Dicom.tasks.segmentation import segment_vertebraes
from Dicom.utils.constants import (
    DICOM_XRAY_SAGITTAL_ROLE_SLUG,
    ROLE_SLUG_TO_PROJECTION_SLUG,
    SEGMENTATION_PIPELINE_VERSION,
)
from Dicom.utils.thumbnail import generate_and_store_thumbnail
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
        # pydicom often returns MultiValue, PersonName, or UID objects; cast to
        # standard types. UID (VR "UI" -- SOPInstanceUID/StudyInstanceUID/
        # SeriesInstanceUID all use it) is a str *subclass*, not a plain str --
        # passing it straight through to the ORM/CAS path/Celery task args
        # worked in theory (isinstance(UID, str) is True) but not reliably in
        # practice against a real DB driver, which is why every id derived
        # from a UI-VR tag came back None-matching (image_id=sop_uid never hit
        # an existing row, so nothing ever deduped). Normalize once here
        # rather than at every call site.
        if isinstance(val, pydicom.uid.UID):
            return str(val)
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

DEFAULT_FILE_ROLE_SLUG = DICOM_XRAY_SAGITTAL_ROLE_SLUG

# SegmentationStatus slugs (seeded by Dicom.management.commands.create_segmentation_statuses):
# a "settled" result the current pipeline may supersede vs. a run already working the image.
_STALE_TRIGGER_SLUGS = ('done', 'error')
_INFLIGHT_SLUGS = ('processing', 'saving')


async def _segmentation_is_stale(sop_uid):
    """True iff this image has a SETTLED segmentation result (done/error) that was
    produced by a pipeline version other than the current SEGMENTATION_PIPELINE_VERSION.

    The version is compared in Python, not via ``.exclude(...__version=CURRENT)``:
    Django's ``exclude()`` on a nullable column does NOT match rows where the column
    IS NULL, and a pre-versioning row (version NULL) is exactly the stale case a
    re-upload must re-run."""
    row = (
        await DicomImage.objects
        .filter(sop_instance_uid=sop_uid)
        .select_related('segmentation_status')
        .afirst()
    )
    if row is None or row.segmentation_status_id is None:
        return False
    if row.segmentation_status.slug not in _STALE_TRIGGER_SLUGS:
        return False
    return row.segmentation_model_version != SEGMENTATION_PIPELINE_VERSION


async def _reuse_or_dispatch_segmentation(image, sop_uid, new_file_hash, *, skip_inflight_guard=False):
    """Borrow an already-``done`` segmentation for byte-identical content that was
    produced by the CURRENT pipeline version, else queue a fresh ``segment_vertebraes``
    run. When ``skip_inflight_guard`` is False, a run already ``processing``/``saving``
    for this image suppresses the dispatch (that run will stamp the current version
    when it finishes) -- the content-changed caller passes True because genuinely new
    bytes need a new run regardless of any in-flight run against the old bytes."""
    reused = (
        await DicomFile.objects.filter(
            hash=new_file_hash,
            image__segmentation_status__slug='done',
            image__segmentation_model_version=SEGMENTATION_PIPELINE_VERSION,
        )
        .exclude(image_id=sop_uid)
        .select_related('image__segmentation_status')
        .afirst()
    )

    if reused is not None:
        image.reference_points = reused.image.reference_points
        image.segmentation_status = reused.image.segmentation_status
        image.segmentation_model_version = reused.image.segmentation_model_version
        image.segmented_at = reused.image.segmented_at
        image.segmentation_error = None
        await image.asave(update_fields=[
            'reference_points', 'segmentation_status',
            'segmentation_model_version', 'segmented_at', 'segmentation_error',
        ])
        # No broadcast needed -- a client connecting to this SOP instance's SSE
        # endpoint self-hydrates 'done' + reference_points straight from the DB row
        # just written (Dicom.v1.views.dcmparse's _segmentation_event_stream), the
        # same mechanism a real Celery run's own _advance_status() broadcasts rely on.
        return

    if not skip_inflight_guard:
        current = (
            await DicomImage.objects
            .filter(sop_instance_uid=sop_uid)
            .select_related('segmentation_status')
            .afirst()
        )
        if (current is not None and current.segmentation_status_id is not None
                and current.segmentation_status.slug in _INFLIGHT_SLUGS):
            return

    # No separate "upload accepted" broadcast here -- the Celery task's own first
    # _advance_status(..., 'processing') call (Dicom.tasks.segmentation) is the sole,
    # DB-write-then-broadcast source of truth for this image's status. A client
    # connecting before the task picks up the job just waits on the live SSE tail
    # for that event, which self-hydration handles correctly on its own.
    segment_vertebraes.delay(sop_uid)


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
    max_count=1-per-Series rule -- the caller (Dicom.v1.views.dcmparse.DcmViewSet.parse)
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

    # 3b. Extract and Store Series
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

    # 3c. Resolve the caller-declared FileRole (defaulting to sagittal) and enforce its
    # max_count=1-per-Series rule before writing Image -- excluding this SOP Instance
    # UID's own existing row (if any) from the count is what makes re-uploading the
    # same image a no-op instead of tripping the limit against itself.
    role_slug = file_role_slug or DEFAULT_FILE_ROLE_SLUG

    # `projection` (clinical metadata) is auto-detected from DICOM tags first;
    # only when those are inconclusive does it fall back to the projection
    # implied by the declared X-ray role, so segmentation can still route to
    # the right model instead of erroring on a NULL projection.
    projection_slug = get_projection_orientation(dcm) or ROLE_SLUG_TO_PROJECTION_SLUG.get(role_slug)
    projection = await Projection.objects.filter(slug=projection_slug).afirst() if projection_slug else None

    role = await FileRole.objects.filter(slug=role_slug).afirst()
    if role is None:
        return Issue(
            status="error", code=400, field="file_role_slug",
            message=f"FileRole '{role_slug}' does not exist.",
        )
    if role.max_count is not None:
        existing_count = await DicomFile.objects.filter(
            series=series, role=role
        ).exclude(image_id=sop_uid).acount()
        issue = check_role_max_count(role, existing_count, 1)
        if issue:
            return issue

    # 4. Extract and Store Image
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
    # identical bytes for the same image skips the ref_count churn and thumbnail
    # regen below. Segmentation still re-runs on an identical re-upload if the
    # stored result came from an older pipeline version (the `elif` further down).
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
            image=image, series=series, role=role,
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

        # Best-effort: a thumbnail is a nice-to-have preview, not something
        # that should ever fail the upload itself (e.g. a DICOM file pydicom
        # can parse metadata from but not decode pixel data for -- unusual,
        # but not a reason to reject an otherwise-valid upload).
        try:
            await generate_and_store_thumbnail(image, dcm)
        except Exception:
            _logger.exception(f"Failed to generate thumbnail for {sop_uid}")

        # New content -> its stored segmentation result (if any) is definitionally
        # stale. Borrow a completed result for this exact content produced by the
        # current pipeline version (e.g. the same physical image re-exported under
        # a different SOPInstanceUID) instead of re-running the YOLO model, else
        # queue a run. skip_inflight_guard: genuinely new bytes need a new run even
        # if a stale run is mid-flight against the old bytes.
        await _reuse_or_dispatch_segmentation(image, sop_uid, new_file_hash, skip_inflight_guard=True)

    elif await _segmentation_is_stale(sop_uid):
        # Byte-identical re-upload: the file is already stored and thumbnailed, but
        # the stored segmentation result came from an older pipeline version --
        # re-run and replace it. Same reuse-or-dispatch path, with the in-flight
        # guard active so an identical re-upload can't pile a duplicate job on a
        # run that's already going.
        await _reuse_or_dispatch_segmentation(image, sop_uid, new_file_hash)

    # else: identical bytes, stored result already at the current pipeline version
    # (or the image was never segmented) -> true no-op.

    return patient, study, series, image