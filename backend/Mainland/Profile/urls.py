from django.urls import path, include

urlpatterns = [
    path("v1/", include('Profile.v1.urls')),
    path("", include('Profile.v1.urls'))
]
