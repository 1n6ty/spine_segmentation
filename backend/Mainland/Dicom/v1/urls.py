from Dicom.v1.views.dcmparse import DcmViewSet
from Dicom.v1.views.user_recent_studies import UserRecentStudiesViewSet

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
# Registered before DcmViewSet's own '' prefix so 'recent-studies/...' resolves
# here first -- no real collision either way, since DcmViewSet's actions live
# under real SOP Instance UIDs (dotted numeric strings, never literally
# "recent-studies"), but registration order stays defensive on principle.
router.register(r'recent-studies', UserRecentStudiesViewSet, basename="UserRecentStudies")
router.register(r'', DcmViewSet, basename="Dicom")

urlpatterns = router.urls
