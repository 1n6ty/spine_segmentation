from django.urls import path, include

urlpatterns = [
    path("v1/", include('DSL.v1.urls')),
    path("", include('DSL.v1.urls'))
]