from rest_framework.routers import DefaultRouter

from FileManager.v1.views.file_role import FileRoleViewSet

router = DefaultRouter()
router.register(r'roles', FileRoleViewSet, basename='FileRole')

urlpatterns = router.urls
