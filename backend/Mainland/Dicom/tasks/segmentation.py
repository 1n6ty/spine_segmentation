import pydicom
from celery import shared_task
from asgiref.sync import async_to_sync
from logging import getLogger
_logger = getLogger('Dicom.tasks.segmentation')

from django.conf import settings
from django.utils import timezone
from channels.layers import get_channel_layer

from Dicom.utils.constants import (
    SEGMENTATION_GROUP,
    SEGMENTATION_MODEL_WEIGHTS,
    SEGMENTATION_PIPELINE_VERSION,
    SEGMENTATION_STATUS_WIRE,
)
from Dicom.utils.pixels import dicom_to_windowed_float32
from Dicom.utils.segmentation.compose import segment_spine_from_S1_to_C2

_models: dict = {}

def _get_model(projection: str):
    if projection not in _models:
        from sahi import AutoDetectionModel
        path = SEGMENTATION_MODEL_WEIGHTS.get(projection, SEGMENTATION_MODEL_WEIGHTS["frontal"])
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

        # 3. Run the YOLO segmentation
        vertebraes_list = segment_spine_from_S1_to_C2(
            pixel_array=pixel_array,
            detection_model=_get_model(image_instance.projection.slug if image_instance.projection else "frontal")
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
