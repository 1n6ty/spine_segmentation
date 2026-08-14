from django.urls import path, include

urlpatterns = [
    path("v1/", include('Company.v1.urls')),
    path("", include('Company.v1.urls'))
]
