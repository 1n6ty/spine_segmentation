from Dicom.v1.views.dcmparse import DcmViewSet

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'', DcmViewSet, basename="Dicom")

urlpatterns = router.urls
