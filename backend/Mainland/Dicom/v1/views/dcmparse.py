from common.schemas.v1.response import ApiResponse, Issue
from common.schemas.v1.errors import UnauthorizedResponse
from common.mixins.v1.viewset import StdViewSet

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.permissions import IsAuthenticated
from rest_framework import serializers

from django.http import HttpResponse

from pydantic import ValidationError
from drf_spectacular.utils import extend_schema, inline_serializer

from Dicom.v1.schemas.dcmparse import Parse_POST_schema, Info_GET_schema
from Dicom.utils.parse import parse_and_store_dicom
from Dicom.models import Patient, Study, Series, DicomImage

class DcmViewSet(StdViewSet):

    @extend_schema(
        summary="Method to parse a dicom file",
        description="Creates or updates specific tables with info from dicom file. It also triggers computing of reference points.",
        request={
            "multipart/form-data": inline_serializer(
                name="DCMParseRequest",
                fields={
                    "file": serializers.FileField(required=True)
                }
            )
        },
        responses={
            200: ApiResponse,
            400: ApiResponse
        },
    )
    @action(detail=False, methods=["post"], url_path="parse", url_name="parse")
    async def parse(self, request: Request) -> Response:
        response: ApiResponse = ApiResponse()
        try:
            parse_data = Parse_POST_schema(**request.data.dict())
        except ValidationError as e:
            for err in e.errors():
                response.add_issue(
                    Issue(
                        status="error",
                        code=400,
                        message=err['msg']
                    )
                )
            return response.set_status(
                status="error",
                code=400
            ).drf_response

        await parse_and_store_dicom(parse_data.file)

        return response.set_status(
            status="ok",
            code=200
        ).drf_response

    @extend_schema(
        summary="Retrieve a previously uploaded DICOM file",
        description=(
            "Streams the raw DICOM file for a given SOP Instance UID. The file lives in the "
            "private MinIO bucket and is never exposed via a direct or presigned URL — this view "
            "checks authentication, then hands the actual byte-streaming off to nginx via "
            "X-Accel-Redirect to an internal-only location."
        ),
        responses={
            401: UnauthorizedResponse,
            404: ApiResponse,
        },
    )
    @action(detail=True, methods=["get"], url_path="file", url_name="file", permission_classes=[IsAuthenticated])
    async def file(self, request: Request, pk=None) -> Response | HttpResponse:
        try:
            image = await DicomImage.objects.aget(sop_instance_uid=pk)
        except DicomImage.DoesNotExist:
            return ApiResponse().add_issue(
                Issue(
                    status="error",
                    code=404,
                    message="DICOM image not found."
                )
            ).set_status(
                status="error",
                code=404
            ).drf_response

        if not image.dicom_file:
            return ApiResponse().add_issue(
                Issue(
                    status="error",
                    code=404,
                    message="No file stored for this image."
                )
            ).set_status(
                status="error",
                code=404
            ).drf_response

        response = HttpResponse(content_type="application/dicom")
        response["X-Accel-Redirect"] = f"/internal/media-private/{image.dicom_file.name}"
        response["Content-Disposition"] = f'attachment; filename="{pk}.dcm"'
        return response
