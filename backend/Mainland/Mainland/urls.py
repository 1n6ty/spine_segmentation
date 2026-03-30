from django.contrib import admin

from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

admin.site.site_header = "Spine Segmentation Admin"
admin.site.site_title = "Spine Segmentation Admin Portal"
admin.site.index_title = "Welcome to Spine Segmentation Researcher Portal"

api_urlpatterns = [
    path('dsl/', include('DSL.urls')),
    path('dcm/', include('Dicom.urls')),
    path('', include('Core.urls')),
]

from Mainland.pages import index

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/', include(api_urlpatterns)), # All API functionality

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    path('<path:lang>', index, name="Core-pages-index-lang"),
    path('<path:lang>/<path:sub>', index, name="Core-pages-index-lang-sub"),
]

handler404 = 'Mainland.pages.view_404'