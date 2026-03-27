import pydicom, numpy as np
from celery import shared_task
from ultralytics.models import YOLO
from asgiref.sync import async_to_sync
from logging import getLogger
_logger = getLogger('Dicom.tasks.segmentation')

from django.conf import settings
from channels.layers import get_channel_layer

from Dicom.utils.segmentation.compose import segment_spine_from_S1_to_C2

SAGITTAL_SPINE_MODEL = YOLO(settings.BASE_DIR / 'Dicom/tasks/weights/yolo26m-seg-sag.pt')
FRONTAL_SPINE_MODEL = YOLO(settings.BASE_DIR / 'Dicom/tasks/weights/yolo26m-seg-fro.pt')

@shared_task(queue='segmentation', ignore_result=True)
def segment_vertebraes(sop_instance_uid: str):
    from Dicom.models import DicomImage

    try:
        channel_layer = get_channel_layer()

        image_instance = DicomImage.objects.get(sop_instance_uid=sop_instance_uid)
        
        dcm = pydicom.dcmread(image_instance.dicom_file.path)
        pixel_array = dcm.pixel_array.astype(float)
        
        # Applying Rescale Slope/Intercept (standard DICOM procedure)
        slope = float(getattr(dcm, 'RescaleSlope', 1))
        intercept = float(getattr(dcm, 'RescaleIntercept', 0))
        pixel_array = pixel_array * slope + intercept

        # IMPROVEMENT: Use Windowing instead of simple Min-Max
        window_center = getattr(dcm, 'WindowCenter', None)
        window_width = getattr(dcm, 'WindowWidth', None)

        if window_center is not None and window_width is not None:
            # Handle cases where window tags are lists
            if isinstance(window_center, pydicom.multival.MultiValue):
                window_center = window_center[0]
            if isinstance(window_width, pydicom.multival.MultiValue):
                window_width = window_width[0]
            
            img_min = window_center - window_width // 2
            img_max = window_center + window_width // 2
            uint8_array = np.clip(pixel_array, img_min, img_max)
            uint8_array = ((uint8_array - img_min) / window_width * 255).astype(np.uint8)
        else:
            # Fallback to Min-Max if no window info exists
            arr_min, arr_max = pixel_array.min(), pixel_array.max()
            uint8_array = (((pixel_array - arr_min) / (arr_max - arr_min)) * 255).astype(np.uint8)

        async_to_sync(channel_layer.group_send)(
            f"Dicom.segment.{sop_instance_uid}",
            {"type": "from_task_event", "data": {"status": "segmentation.processing"}}
        )
        # 3. Run the YOLO segmentation
        vertebraes_list = segment_spine_from_S1_to_C2(
            pixel_array=uint8_array, 
            model=SAGITTAL_SPINE_MODEL if image_instance.projection == "sagittal" else FRONTAL_SPINE_MODEL, 
            conf=0.5
        )
        
        async_to_sync(channel_layer.group_send)(
            f"Dicom.segment.{sop_instance_uid}",
            {"type": "from_task_event", "data": {"status": "saving"}}
        )

        parsed_vertebraes = {"vertebraes": []}
        for v in vertebraes_list:
            parsed_vertebraes["vertebraes"].append({
                "name": v.name,
                "points": [[float(p[0]), float(p[1])] for p in v.reference_points]
            })
        _logger.info(parsed_vertebraes)

        # 4. Save results (Using update_fields is safer for concurrent saves)
        image_instance.reference_points = parsed_vertebraes
        image_instance.save(update_fields=['reference_points'])

        async_to_sync(channel_layer.group_send)(
            f"Dicom.segment.{sop_instance_uid}",
            {"type": "from_task_event", "data": {"status": "done"}}
        )

    except DicomImage.DoesNotExist:
        _logger.error(f"Image with UID {sop_instance_uid} not found in DB.")
    except Exception as e:
        _logger.exception(f"Failed to segment {sop_instance_uid}")
        raise e