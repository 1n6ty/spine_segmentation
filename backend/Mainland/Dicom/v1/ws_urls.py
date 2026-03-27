from Dicom.v1.ws_consumers.segmentation import SegmConsumer
from django.urls import re_path

websocket_urlpatterns = [
    re_path(r"ws/dcm/(?:v1/)?segment/(?P<sop_uid>\w+)/$", SegmConsumer.as_asgi()),
]