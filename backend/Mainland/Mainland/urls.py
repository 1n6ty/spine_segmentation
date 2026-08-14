from django.contrib import admin
from django.urls import path, include, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

admin.site.site_header = "Spine-Segmentation Admin"
admin.site.site_title = "Spine-Segmentation Admin Portal"
admin.site.index_title = "Welcome to Spine-Segmentation Researcher Portal"

api_urlpatterns = [
    path('dcm/', include('Dicom.urls')),
    path('company/', include('Company.urls')),
    path('profiles/', include('Profile.urls')),
    path('files/', include('FileManager.urls')),
    path('', include('Core.urls')),
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

from Mainland.pages import index

frontend_urlpatterns = [
    path('', index, name="pages-index"),
    re_path(r'^(?!admin(/|$)|api(/|$)|o(/|$))(?P<sub>.+)$', index, name="pages-index-sub")
]

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/', include(api_urlpatterns)),

    path('', include(frontend_urlpatterns))
]
