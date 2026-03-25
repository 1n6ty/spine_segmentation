from common.schema.v1 import ApiResponse
from common.viewsets.v1 import StdViewSet

from rest_framework.decorators import action
from rest_framework.response import Response

from django.http import HttpRequest
from drf_spectacular.utils import extend_schema

class HealthViewSet(StdViewSet):

    @extend_schema(
        summary="Health Check",
        description="Check if the service is up and running.",
        responses={200: ApiResponse},
    )
    @action(detail=False, methods=["get"], url_path="health", url_name="view")
    async def health(self, request: HttpRequest) -> Response:
        return ApiResponse().set_status(
            status="ok",
            code=200
        ).drf_response