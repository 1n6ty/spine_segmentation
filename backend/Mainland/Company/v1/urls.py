from rest_framework.routers import DefaultRouter

from Company.v1.views.company import CompanyViewSet

router = DefaultRouter()
router.register(r'', CompanyViewSet, basename="Company")

urlpatterns = router.urls
