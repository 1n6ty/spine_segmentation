from DSL.v1.views.dsl import DSL_ViewSet

from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'', DSL_ViewSet, basename="")

urlpatterns = router.urls
