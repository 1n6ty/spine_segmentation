from Core.v1.views.health import HealthViewSet
from Core.v1.views.auth import AuthViewSet

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'', AuthViewSet, basename="Core-auth")
router.register(r'', HealthViewSet, basename="Core-health")

urlpatterns = router.urls
