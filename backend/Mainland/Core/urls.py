from django.urls import path, include

urlpatterns = [
    path("v1/", include('Core.v1.urls')),
    path("", include('Core.v1.urls'))
]
