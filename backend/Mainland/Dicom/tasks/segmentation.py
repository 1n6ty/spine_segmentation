import pydicom
from celery import shared_task
from asgiref.sync import async_to_sync
from logging import getLogger
_logger = getLogger('Dicom.tasks.segmentation')

from django.conf import settings
from django.utils import timezone
from channels.layers import get_channel_layer

from Dicom.utils.constants import (
    ROLE_SLUG_TO_PROJECTION_SLUG,
    SEGMENTATION_GROUP,
    SEGMENTATION_MODEL_WEIGHTS,
    SEGMENTATION_PIPELINE_VERSION,
    SEGMENTATION_STATUS_WIRE,
)
from Dicom.utils.pixels import dicom_to_windowed_float32
from Dicom.utils.segmentation.compose import segment_spine_from_S1_to_C2

_models: dict = {}

def _get_model(projection: str):
    # No silent fallback to a default projection here: routing a sagittal
    # (lateral) film through the frontal model -- or vice versa -- yields
    # confidently-wrong vertebra positions rather than an error, which in a
    # spine-measurement tool is the worst possible failure. An unresolved
    # projection must fail loudly (caught by segment_vertebraes -> 'error'
    # status) so the cause (DICOM metadata / get_projection_orientation) gets
    # fixed, not papered over. This used to be masked: the frontal weights
    # file didn't exist, so the old `.get(projection, ...["frontal"])` fallback
    # raised FileNotFoundError anyway; once frontal weights shipped it started
    # silently mis-segmenting instead.
    if projection not in SEGMENTATION_MODEL_WEIGHTS:
        raise ValueError(
            f"No segmentation model for projection {projection!r}; "
            f"known projections: {sorted(SEGMENTATION_MODEL_WEIGHTS)}"
        )
    if projection not in _models:
        from sahi import AutoDetectionModel
        path = SEGMENTATION_MODEL_WEIGHTS[projection]
        # Logged so "is celery using the right model for this projection?" is
        # answerable straight from the worker log. _models is a process-global
        # cache that never reloads a file it has already loaded, so this line
        # also marks the one moment a weights change actually takes effect --
        # i.e. only after a worker restart.
        _logger.info("Loading %s segmentation model from %s", projection, path)
        _models[projection] = AutoDetectionModel.from_pretrained(
            model_type="ultralytics",
            model_path=str(settings.BASE_DIR / path),
            confidence_threshold=0.3,
            device="cpu",
        )
    return _models[projection]

def _advance_status(channel_layer, image_instance, slug, ref_points=None):
    """Persists the DicomImage's segmentation_status (by SegmentationStatus.slug) and
    broadcasts the matching wire status to the Channels group, in that order — the DB
    write always lands before any listener can observe the event, so a client that
    connects mid-broadcast still sees consistent state on its next DB read."""
    from Dicom.models import SegmentationStatus
    image_instance.segmentation_status = SegmentationStatus.objects.get(slug=slug)
    image_instance.save(update_fields=['segmentation_status'])
    async_to_sync(channel_layer.group_send)(
        SEGMENTATION_GROUP.format(image_instance.sop_instance_uid),
        {"type": "from_task_event", "data": {"status": SEGMENTATION_STATUS_WIRE[slug], "ref_points": ref_points}}
    )

@shared_task(queue='db', ignore_result=True)
def segment_vertebraes(sop_instance_uid: str):
    from Dicom.models import DicomImage

    channel_layer = get_channel_layer()

    try:
        image_instance = DicomImage.objects.get(sop_instance_uid=sop_instance_uid)

        _advance_status(channel_layer, image_instance, 'processing')
        # FieldFile.path is a local-filesystem-only API — S3Boto3Storage (used for
        # the private MinIO bucket) doesn't implement it. Read through the file
        # object instead, which works for any storage backend.
        with image_instance.xray_file.file.open('rb') as dicom_fp:
            dcm = pydicom.dcmread(dicom_fp)
            pixel_array = dicom_to_windowed_float32(dcm)

        # 3. Run the YOLO segmentation. Require a known projection -- if
        # get_projection_orientation() couldn't classify the film from its
        # ViewPosition / PatientOrientation / SeriesDescription, projection is
        # None here; segmenting anyway would just pick a model at random and
        # emit plausible-looking but wrong landmarks.
        stored_projection = image_instance.projection.slug if image_instance.projection else None
        role = getattr(getattr(image_instance, "xray_file", None), "role", None)
        role_slug = role.slug if role else None
        projection_slug = stored_projection
        if projection_slug is None:
            # Ingest (Dicom.utils.parse) normally resolves this from the declared
            # X-ray role when the DICOM tags can't -- but a row stored before that
            # fallback existed can still have projection NULL, and a stale-version
            # re-dispatch re-runs only this task, not parse. Recover the same way
            # from the persisted role so those rows segment instead of erroring.
            projection_slug = ROLE_SLUG_TO_PROJECTION_SLUG.get(role_slug)

        # One line that pins down which model this run uses and why -- so a
        # "wrong model for the projection" report can be confirmed or ruled out
        # from the worker log alone. A stored projection that disagrees with the
        # declared X-ray role (e.g. get_projection_orientation misread the DICOM
        # tags) is the usual culprit, so surface that mismatch explicitly.
        expected_from_role = ROLE_SLUG_TO_PROJECTION_SLUG.get(role_slug)
        if expected_from_role is not None and stored_projection is not None and expected_from_role != stored_projection:
            _logger.warning(
                "%s: stored projection %r disagrees with X-ray role %r (implies %r); "
                "using stored projection. Check get_projection_orientation for this film.",
                sop_instance_uid, stored_projection, role_slug, expected_from_role,
            )
        _logger.info(
            "%s: segmenting as projection=%r (stored=%r, role=%r) with weights %s",
            sop_instance_uid, projection_slug, stored_projection, role_slug,
            SEGMENTATION_MODEL_WEIGHTS.get(projection_slug),
        )

        if projection_slug not in SEGMENTATION_MODEL_WEIGHTS:
            raise ValueError(
                f"Cannot segment {sop_instance_uid}: projection is {projection_slug!r} "
                f"(DICOM ViewPosition/PatientOrientation/SeriesDescription did not "
                f"identify frontal vs sagittal, and no X-ray role to fall back on). "
                f"Refusing to guess a model."
            )
        vertebraes_list = segment_spine_from_S1_to_C2(
            pixel_array=pixel_array,
            detection_model=_get_model(projection_slug)
        )

        _advance_status(channel_layer, image_instance, 'saving')

        parsed_vertebraes = {"vertebraes": []}
        for v in vertebraes_list:
            parsed_vertebraes["vertebraes"].append({
                "name": v.name,
                "points": [[float(p[0]), float(p[1])] for p in v.reference_points]
            })
        _logger.info(parsed_vertebraes)

        # 4. Save results (Using update_fields is safer for concurrent saves).
        # Stamp the pipeline version + timestamp here, before the 'done' broadcast,
        # so a client that self-hydrates immediately after that event reads a row
        # already marked current -- otherwise its next /api/dcm/parse/ would see
        # 'done' + a stale-looking version and needlessly re-dispatch.
        image_instance.reference_points = parsed_vertebraes
        image_instance.segmentation_model_version = SEGMENTATION_PIPELINE_VERSION
        image_instance.segmented_at = timezone.now()
        image_instance.save(update_fields=['reference_points', 'segmentation_model_version', 'segmented_at'])

        _advance_status(channel_layer, image_instance, 'done', ref_points=parsed_vertebraes)

    except DicomImage.DoesNotExist:
        _logger.error(f"Image with UID {sop_instance_uid} not found in DB.")
    except Exception as e:
        _logger.exception(f"Failed to segment {sop_instance_uid}")
        try:
            image_instance = DicomImage.objects.get(sop_instance_uid=sop_instance_uid)
            image_instance.segmentation_error = str(e)
            # Stamp the version on failure too: a failure under the *current*
            # pipeline must not be re-dispatched on every identical re-upload --
            # only a failure left by an older version (or NULL) is stale.
            image_instance.segmentation_model_version = SEGMENTATION_PIPELINE_VERSION
            image_instance.segmented_at = timezone.now()
            image_instance.save(update_fields=['segmentation_error', 'segmentation_model_version', 'segmented_at'])
            _advance_status(channel_layer, image_instance, 'error')
        except DicomImage.DoesNotExist:
            pass
        raise e
