from django.urls import path, include

urlpatterns = [
    path("v1/", include('Dicom.v1.urls')),
    path("", include('Dicom.v1.urls'))
]
