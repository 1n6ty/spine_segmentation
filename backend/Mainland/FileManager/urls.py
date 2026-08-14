from django.urls import include, path

urlpatterns = [
    path("v1/", include('FileManager.v1.urls')),
    path("", include('FileManager.v1.urls')),
]
