from Profile.v1.views.profiles import ProfilesViewSet

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'', ProfilesViewSet, basename="Profile")

urlpatterns = router.urls